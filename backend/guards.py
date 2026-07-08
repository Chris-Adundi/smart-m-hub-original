from fastapi import HTTPException
from auth import normalize_role


# =========================
# GET SCHOOL ID SAFELY
# =========================
def get_school_id(user: dict):
    role = normalize_role(user.get("role"))
    school_id = user.get("school_id")

    # super admin bypass
    if role == "super_admin":
        return None

    if not school_id:
        raise HTTPException(
            status_code=403,
            detail="School context required"
        )

    return school_id


# =========================
# STRICT SCHOOL CHECK (SIMPLIFIED & SAFE)
# =========================
def require_school(user: dict):
    role = normalize_role(user.get("role"))

    if role == "super_admin":
        return True

    if not user.get("school_id"):
        raise HTTPException(
            status_code=403,
            detail="No school assigned"
        )

    return True
