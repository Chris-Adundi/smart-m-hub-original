from fastapi import HTTPException


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
# NORMALIZE ROLE (FIXED SAFETY)
# =========================
def normalize_role(role: str) -> str:
    if not role:
        return ""
    return str(role).strip().lower().replace(" ", "_")


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