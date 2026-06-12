from fastapi import HTTPException


# =========================
# ROLE NORMALIZER
# =========================
def normalize_role(role: str | None) -> str:
    if not role:
        return "UNKNOWN"
    return str(role).strip().upper()


# =========================
# ROLE CHECKER (CORE GUARD)
# =========================
def require_roles(current_user: dict, allowed_roles: list[str]):
    """
    Centralized role enforcement for entire system.
    Raises HTTPException if user role is not allowed.
    """

    role = normalize_role(current_user.get("role"))

    if role not in allowed_roles:
        raise HTTPException(
            status_code=403,
            detail="Unauthorized"
        )

    return role


# =========================
# PRESET ROLE GROUPS
# =========================

ADMIN_ROLES = ["SCHOOL_ADMIN", "SUPER_ADMIN"]

STAFF_ROLES = ["SCHOOL_ADMIN", "TEACHER", "SECRETARY"]

FINANCE_ROLES = ["SCHOOL_ADMIN", "FINANCE"]

PUBLIC_ROLES = STAFF_ROLES