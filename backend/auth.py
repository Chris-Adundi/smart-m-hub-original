from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from jose import jwt, JWTError
from passlib.context import CryptContext
from motor.motor_asyncio import AsyncIOMotorClient

import os

# =========================
# DB
# =========================
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "test_database")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# =========================
# SECURITY CONFIG
# =========================
SECRET_KEY = os.getenv("SECRET_KEY", "CHANGE_ME")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# =========================
# HELPERS
# =========================
def normalize_role(role: Any) -> str:
    return str(role or "").strip().lower()


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

# =========================
# TOKEN
# =========================
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    payload = data.copy()

    expire = now_utc() + (
        expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    payload.update({"exp": expire})
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None

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