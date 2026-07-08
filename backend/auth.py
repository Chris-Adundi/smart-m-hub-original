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

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "smart_m_hub")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# =========================
# SECURITY CONFIG
# =========================
APP_ENV = os.getenv("APP_ENV", os.getenv("ENV", "development")).lower()
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


def decode_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM], issuer=JWT_ISSUER)
        if payload.get("typ") != "access":
            return None
        return payload
    except JWTError:
        return None


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
            "$set": {"email": str(email or "").strip().lower(), "school_code": str(school_code or "").strip().upper(), "last_failure": now, "reason": reason},
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


async def log_security_event(action: str, user: Optional[dict] = None, metadata: Optional[dict] = None):
    await db.audit_logs.insert_one({
        "action": action,
        "performed_by": (user or {}).get("email"),
        "user_id": (user or {}).get("user_id") or (user or {}).get("id"),
        "school_id": (user or {}).get("school_id"),
        "metadata": metadata or {},
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
        "email": user.get("email"),
        "full_name": user.get("full_name"),
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
