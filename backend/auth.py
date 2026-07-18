from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from jose import jwt, JWTError
from passlib.context import CryptContext
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ReturnDocument

import os
import re
import secrets

# =========================
# DB
# =========================
from dotenv import load_dotenv
from pathlib import Path
from config import load_secret_file_env, validate_environment

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")
load_secret_file_env(["SECRET_KEY", "MONGO_URL"])
validate_environment()

DB_NAME = os.getenv("DB_NAME", "smart_m_hub")
APP_ENV = os.getenv("APP_ENV", os.getenv("ENV", "development")).lower()
MONGO_URL = os.getenv("MONGO_URL")
if not MONGO_URL:
    if APP_ENV in {"production", "prod"}:
        raise RuntimeError("MONGO_URL must be set in production")
    MONGO_URL = "mongodb://localhost:27017"

client = AsyncIOMotorClient(
    MONGO_URL,
    maxPoolSize=int(os.getenv("MONGO_MAX_POOL_SIZE", "100")),
    minPoolSize=int(os.getenv("MONGO_MIN_POOL_SIZE", "0")),
    serverSelectionTimeoutMS=int(os.getenv("MONGO_SERVER_SELECTION_TIMEOUT_MS", "5000")),
    connectTimeoutMS=int(os.getenv("MONGO_CONNECT_TIMEOUT_MS", "10000")),
    socketTimeoutMS=int(os.getenv("MONGO_SOCKET_TIMEOUT_MS", "20000")),
)
db = client[DB_NAME]

# =========================
# SECURITY CONFIG
# =========================
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    if APP_ENV in {"production", "prod"}:
        raise RuntimeError("SECRET_KEY must be set in production")
    SECRET_KEY = os.getenv(
        "DEV_SECRET_KEY",
        "smart-m-hub-local-development-secret-change-before-production"
    )
ALGORITHM = "HS256"
JWT_ISSUER = "smart-m-hub"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "14"))
LOGIN_MAX_ATTEMPTS = int(os.getenv("LOGIN_MAX_ATTEMPTS", "5"))
LOGIN_LOCKOUT_MINUTES = int(os.getenv("LOGIN_LOCKOUT_MINUTES", "15"))
PASSWORD_MIN_LENGTH = int(os.getenv("PASSWORD_MIN_LENGTH", "8"))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# =========================
# HELPERS
# =========================
VALID_SYSTEM_ROLES = {
    "super_admin",
    "school_admin",
    "teacher",
    "finance",
    "secretary",
    "supporting_staff",
    "student",
    "parent",
}


def normalize_role(role: Any) -> str:
    raw = str(role or "").strip().lower().replace("-", "_").replace(" ", "_")
    aliases = {
        "admin": "school_admin",
        "administrator": "school_admin",
        "principal": "school_admin",
        "headteacher": "school_admin",
        "schooladmin": "school_admin",
        "platform_admin": "super_admin",
        "platformadmin": "super_admin",
        "superadmin": "super_admin",
        "finance_officer": "finance",
        "accountant": "finance",
        "bursar": "finance",
        "guardian": "parent",
    }
    normalized = aliases.get(raw, raw)
    return normalized if normalized in VALID_SYSTEM_ROLES else ""


def now_utc():
    return datetime.now(timezone.utc)

# =========================
# PASSWORDS
# =========================
def verify_password(plain: str, hashed: str) -> bool:
    if not plain or not hashed:
        return False
    return pwd_context.verify(plain, hashed)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def validate_password_strength(password: str, *, allow_generated: bool = False) -> None:
    if not password or len(password) < PASSWORD_MIN_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"Password must be at least {PASSWORD_MIN_LENGTH} characters"
        )

    if allow_generated:
        return

    checks = [
        re.search(r"[A-Z]", password),
        re.search(r"[a-z]", password),
        re.search(r"\d", password),
    ]
    if not all(checks):
        raise HTTPException(
            status_code=400,
            detail="Password must include uppercase, lowercase, and numeric characters"
        )

# =========================
# TOKEN
# =========================
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    payload = data.copy()

    issued_at = now_utc()
    expire = issued_at + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))

    payload.update({
        "exp": expire,
        "iat": issued_at,
        "iss": JWT_ISSUER,
        "typ": "access",
        "jti": secrets.token_urlsafe(16),
    })
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(data: dict, expires_delta: Optional[timedelta] = None):
    payload = data.copy()
    issued_at = now_utc()
    expire = issued_at + (expires_delta or timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS))
    payload.update({
        "exp": expire,
        "iat": issued_at,
        "iss": JWT_ISSUER,
        "typ": "refresh",
        "jti": secrets.token_urlsafe(24),
    })
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM], issuer=JWT_ISSUER)
        if payload.get("typ") != "access":
            return None
        return payload
    except JWTError:
        return None


def decode_refresh_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM], issuer=JWT_ISSUER)
        if payload.get("typ") != "refresh":
            return None
        return payload
    except JWTError:
        return None


def redact_sensitive(value: Any) -> Any:
    sensitive_keys = {
        "password",
        "password_hash",
        "hashed_password",
        "new_password",
        "confirm_password",
        "token",
        "access_token",
        "refresh_token",
        "secret",
        "mfa_secret",
        "code",
        "reset_code",
        "temporary_password",
    }
    if isinstance(value, dict):
        cleaned = {}
        for key, item in value.items():
            normalized = str(key).lower()
            if normalized in sensitive_keys or normalized.endswith("_token") or normalized.endswith("_secret"):
                cleaned[key] = "[REDACTED]"
            else:
                cleaned[key] = redact_sensitive(item)
        return cleaned
    if isinstance(value, list):
        return [redact_sensitive(item) for item in value]
    return value


def login_attempt_key(email: str, school_code: Optional[str] = None) -> str:
    return f"{str(email or '').strip().lower()}|{str(school_code or '').strip().upper()}"


async def assert_login_not_locked(email: str, school_code: Optional[str] = None):
    attempt = await db.login_attempts.find_one({"key": login_attempt_key(email, school_code)})
    locked_until = attempt.get("locked_until") if attempt else None
    if locked_until and locked_until.tzinfo is None:
        locked_until = locked_until.replace(tzinfo=timezone.utc)
    if locked_until and locked_until > now_utc():
        raise HTTPException(status_code=423, detail="Account temporarily locked. Try again later.")


async def record_login_failure(email: str, school_code: Optional[str] = None, reason: str = "invalid_credentials"):
    key = login_attempt_key(email, school_code)
    now = now_utc()
    attempt = await db.login_attempts.find_one_and_update(
        {"key": key},
        {
            "$inc": {"attempts": 1},
            "$set": {
                "email": str(email or "").strip().lower(),
                "school_code": str(school_code or "").strip().upper(),
                "last_failure": now,
                "reason": reason,
                "expires_at": now + timedelta(days=1),
            },
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    attempts = int((attempt or {}).get("attempts") or 0)
    if attempts >= LOGIN_MAX_ATTEMPTS:
        await db.login_attempts.update_one(
            {"key": key},
            {"$set": {"locked_until": now + timedelta(minutes=LOGIN_LOCKOUT_MINUTES), "updated_at": now}}
        )


async def clear_login_failures(email: str, school_code: Optional[str] = None):
    await db.login_attempts.delete_one({"key": login_attempt_key(email, school_code)})


def audit_event_category(action: str) -> str:
    normalized = str(action or "").lower()
    if "login" in normalized or "password" in normalized or "mfa" in normalized or "token" in normalized:
        return "authentication"
    if "staff" in normalized or "role" in normalized or "permission" in normalized:
        return "authorization"
    if "finance" in normalized or "payment" in normalized or "mpesa" in normalized:
        return "finance"
    if "assessment" in normalized or "report" in normalized or "exam" in normalized:
        return "academic"
    if "school" in normalized:
        return "tenant_admin"
    return "system"


def audit_event_severity(action: str) -> str:
    normalized = str(action or "").lower()
    if any(token in normalized for token in ["failed", "rejected", "deleted", "suspended", "locked"]):
        return "warning"
    if any(token in normalized for token in ["approved", "completed", "reset", "mfa", "created"]):
        return "info"
    return "notice"


async def log_security_event(action: str, user: Optional[dict] = None, metadata: Optional[dict] = None):
    await db.audit_logs.insert_one({
        "event_version": 1,
        "action": action,
        "category": audit_event_category(action),
        "severity": audit_event_severity(action),
        "performed_by": (user or {}).get("email"),
        "user_id": (user or {}).get("user_id") or (user or {}).get("id"),
        "school_id": (user or {}).get("school_id"),
        "role": normalize_role((user or {}).get("role")),
        "metadata": redact_sensitive(metadata or {}),
        "timestamp": now_utc(),
    })

# =========================
# CURRENT USER
# =========================
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Dict[str, Any]:

    token = credentials.credentials
    payload = decode_token(token)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )

    user_id = payload.get("user_id")
    token_role = normalize_role(payload.get("role"))
    school_id = payload.get("school_id")
    session_id = payload.get("sid")

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token"
        )

    # =========================
    # FIX #1: SAFE USER LOOKUP (id OR _id)
    # =========================
    user = await db.users.find_one({
        "$or": [
            {"id": user_id},
            {"_id": user_id}
        ]
    })

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    # =========================
    # ACCOUNT STATUS
    # =========================
    if user.get("is_active") is False:
        raise HTTPException(status_code=403, detail="Account disabled")

    if user.get("is_suspended") is True:
        raise HTTPException(status_code=403, detail="Account suspended")

    # =========================
    # ROLE VALIDATION
    # =========================
    db_role = normalize_role(user.get("role"))

    if db_role != token_role:
        raise HTTPException(
            status_code=403,
            detail="Role mismatch"
        )

    if session_id:
        session = await db.auth_sessions.find_one({
            "id": str(session_id),
            "user_id": str(user.get("id") or user.get("_id")),
            "revoked": {"$ne": True},
        })
        expires_at = session.get("expires_at") if session else None
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
        if expires_at and expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if not session or (expires_at and expires_at < now_utc()):
            raise HTTPException(status_code=401, detail="Session has expired")

    platform_settings = await db.platform_settings.find_one({}, {"_id": 0}) or {}
    if platform_settings.get("maintenance_mode") is True and db_role != "super_admin":
        raise HTTPException(status_code=503, detail="Platform is in maintenance mode")

    # =========================
    # FIX #2: SCHOOL ISOLATION SAFETY
    # =========================
    db_school_id = user.get("school_id")

    if db_role != "super_admin":

        if not school_id or not db_school_id:
            raise HTTPException(
                status_code=403,
                detail="Missing school context"
            )

        if str(db_school_id) != str(school_id):
            raise HTTPException(
                status_code=403,
                detail="School access denied"
            )

        school = await db.schools.find_one({"id": str(db_school_id)})
        if not school:
            raise HTTPException(status_code=403, detail="School not found")

        approval_status = str(school.get("approval_status") or "pending").lower()
        subscription_status = str(school.get("subscription_status") or "inactive").lower()

        if approval_status != "approved":
            raise HTTPException(status_code=403, detail="School is pending platform approval")

        if school.get("is_active") is False or str(school.get("status") or "").lower() in {"suspended", "inactive"}:
            raise HTTPException(status_code=403, detail="School access is disabled")

        if subscription_status in {"expired", "suspended", "inactive"}:
            raise HTTPException(status_code=403, detail="School subscription is not active")

    return {
        "user_id": str(user.get("id") or user.get("_id")),
        "role": db_role,
        "school_id": school_id,
        "session_id": str(session_id) if session_id else None,
        "email": user.get("email"),
        "full_name": user.get("full_name"),
        "student_id": user.get("student_id"),
        "admission_number": user.get("admission_number"),
        "student_access_code": user.get("student_access_code"),
    }

# =========================
# ROLE GUARD
# =========================
def require_roles(*allowed_roles: str):

    allowed = [r.lower() for r in allowed_roles]

    async def wrapper(user=Depends(get_current_user)):

        if user["role"] not in allowed:
            raise HTTPException(
                status_code=403,
                detail=f"Requires roles: {allowed}"
            )

        return user

    return wrapper

# =========================
# AUTH HELPERS
# =========================
async def get_user_by_email(email: str):
    return await db.users.find_one({"email": email})

# =========================
# LOGIN
# =========================
async def authenticate_user(email: str, password: str):

    user = await get_user_by_email(email)

    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not verify_password(password, user.get("password_hash")):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    return user


async def login_user(email: str, password: str):

    user = await authenticate_user(email, password)

    user_id = str(user.get("id") or user.get("_id"))
    role = normalize_role(user.get("role"))
    school_id = user.get("school_id")

    token = create_access_token({
        "user_id": user_id,
        "role": role,
        "school_id": school_id
    })

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user_id,
            "email": user["email"],
            "role": role,
            "school_id": school_id
        }
    }
