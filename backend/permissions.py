from fastapi import HTTPException
from auth import normalize_role


# =========================
# ROLE PERMISSION MAP
# =========================

ROLE_PERMISSIONS = {
    "super_admin": ["*"],

    "school_admin": [
        "school:*",
        "students:*",
        "staff:*",
        "results:*",
        "attendance:*",
        "payments:*",
        "announcements:*",
        "finance:*"
    ],

    "secretary": [
        "students:read",
        "students:write",
        "attendance:write",
        "announcements:write"
    ],

    "teacher": [
        "students:read",
        "attendance:write",
        "results:write",
        "announcements:read"
    ],

    "finance": [
        "payments:*",
        "finance:*"
    ],

    "parent": [
        "students:read",
        "results:read",
        "attendance:read"
    ],

    "student": [
        "results:read",
        "attendance:read"
    ]
}


# =========================
# CHECK PERMISSION
# =========================
def check_permission(user: dict, resource: str, action: str = "*"):
    role = normalize_role(user.get("role"))

    # super admin override
    if role == "super_admin":
        return True

    permissions = ROLE_PERMISSIONS.get(role, [])

    full = f"{resource}:{action}"
    wildcard = f"{resource}:*"

    # global wildcard
    if "*" in permissions:
        return True

    # direct match
    if full in permissions or wildcard in permissions:
        return True

    raise HTTPException(status_code=403, detail="Permission denied")
