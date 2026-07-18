from __future__ import annotations

import base64
import hashlib
import hmac
import re
import time
from typing import Any, Iterable, Optional

from fastapi import HTTPException, status

from auth import normalize_role


STAFF_ROLES = {"teacher", "finance", "secretary", "supporting_staff"}
SENSITIVE_KEYS = {
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


def same_school(user: dict, resource_school_id: Any) -> bool:
    role = normalize_role(user.get("role"))
    if role == "super_admin":
        return True
    user_school_id = str(user.get("school_id") or "").strip()
    target_school_id = str(resource_school_id or "").strip()
    return bool(user_school_id and target_school_id and user_school_id == target_school_id)


def require_same_school(user: dict, resource_school_id: Any) -> bool:
    if not same_school(user, resource_school_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied for this school resource")
    return True


def require_role(user: dict, allowed_roles: Iterable[str]) -> bool:
    role = normalize_role(user.get("role"))
    allowed = {normalize_role(item) for item in allowed_roles}
    if role not in allowed:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to perform this action")
    return True


def require_school_admin(user: dict) -> bool:
    return require_role(user, {"school_admin"})


def can_manage_staff(user: dict, target_user: dict) -> bool:
    role = normalize_role(user.get("role"))
    if role == "super_admin":
        return True
    if role != "school_admin":
        return False
    target_role = normalize_role(target_user.get("role"))
    return target_role in STAFF_ROLES and same_school(user, target_user.get("school_id"))


def require_can_manage_staff(user: dict, target_user: dict) -> bool:
    if not can_manage_staff(user, target_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return True


def can_view_student(user: dict, student: dict) -> bool:
    role = normalize_role(user.get("role"))
    if role in {"super_admin", "school_admin", "teacher", "secretary", "finance"}:
        return same_school(user, student.get("school_id"))
    if role in {"student", "parent"}:
        if not same_school(user, student.get("school_id")):
            return False
        identifiers = {
            str(user.get("student_id") or ""),
            str(user.get("admission_number") or ""),
            str(user.get("student_access_code") or ""),
        }
        return any(
            str(student.get(field) or "") in identifiers
            for field in ("id", "admission_number", "student_access_code")
        )
    return False


def can_edit_assessment(user: dict, report: dict) -> bool:
    role = normalize_role(user.get("role"))
    if not same_school(user, report.get("school_id")):
        return False
    return role in {"school_admin", "teacher"} and str(report.get("status") or "draft") == "draft"


def can_publish_report(user: dict, report: dict) -> bool:
    return normalize_role(user.get("role")) == "school_admin" and same_school(user, report.get("school_id"))


def can_manage_finance(user: dict) -> bool:
    return normalize_role(user.get("role")) in {"school_admin", "finance"}


def redact_sensitive(value: Any) -> Any:
    if isinstance(value, dict):
        cleaned = {}
        for key, item in value.items():
            normalized = str(key).lower()
            if normalized in SENSITIVE_KEYS or normalized.endswith("_token") or normalized.endswith("_secret"):
                cleaned[key] = "[REDACTED]"
            else:
                cleaned[key] = redact_sensitive(item)
        return cleaned
    if isinstance(value, list):
        return [redact_sensitive(item) for item in value]
    return value


def safe_filename(filename: Optional[str]) -> str:
    name = str(filename or "upload").strip()
    name = re.sub(r"[/\\\x00-\x1f]+", "_", name)
    return name[:180] or "upload"


def sha256_hex(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def validate_magic_bytes(payload: bytes, content_type: str) -> None:
    sample = payload[:16]
    content_type = str(content_type or "").lower()
    signatures = {
        "image/jpeg": [b"\xff\xd8\xff"],
        "image/png": [b"\x89PNG\r\n\x1a\n"],
        "image/webp": [b"RIFF"],
        "application/pdf": [b"%PDF-"],
    }
    expected = signatures.get(content_type)
    if expected and not any(sample.startswith(signature) for signature in expected):
        raise HTTPException(status_code=400, detail="File content does not match declared type")
    if content_type == "image/webp" and payload[8:12] != b"WEBP":
        raise HTTPException(status_code=400, detail="File content does not match declared type")


def generate_mfa_secret() -> str:
    seed = hashlib.sha256(str(time.time_ns()).encode("utf-8")).digest()
    return base64.b32encode(seed[:20]).decode("ascii").rstrip("=")


def totp_code(secret: str, timestamp: Optional[int] = None, step: int = 30, digits: int = 6) -> str:
    normalized = str(secret or "").strip().replace(" ", "").upper()
    padding = "=" * ((8 - len(normalized) % 8) % 8)
    key = base64.b32decode(normalized + padding)
    counter = int((timestamp or int(time.time())) / step)
    msg = counter.to_bytes(8, "big")
    digest = hmac.new(key, msg, hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    code = int.from_bytes(digest[offset:offset + 4], "big") & 0x7FFFFFFF
    return str(code % (10 ** digits)).zfill(digits)


def verify_totp(secret: str, code: str, window: int = 1) -> bool:
    candidate = str(code or "").strip()
    if not re.fullmatch(r"\d{6}", candidate):
        return False
    now = int(time.time())
    for drift in range(-window, window + 1):
        if hmac.compare_digest(totp_code(secret, now + drift * 30), candidate):
            return True
    return False
