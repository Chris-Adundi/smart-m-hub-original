from __future__ import annotations

SYSTEM_ROLES = {
    "super_admin",
    "school_admin",
    "teacher",
    "finance",
    "secretary",
    "supporting_staff",
    "student",
    "parent",
}

STAFF_AUTH_ROLES = {
    "teacher",
    "finance",
    "secretary",
    "supporting_staff",
}

STAFF_DESIGNATIONS = {
    "teacher",
    "deputy_principal",
    "principal",
    "finance_officer",
    "secretary",
    "librarian",
    "store_keeper",
    "nurse",
    "guidance_counselling",
    "games_teacher",
    "laboratory_technician",
    "ict_officer",
    "boarding_master",
    "boarding_mistress",
    "driver",
    "security_officer",
    "cook",
    "cleaner",
    "other_staff",
}


def normalize_label(value: object) -> str:
    return str(value or "").strip().lower().replace("-", "_").replace(" ", "_").replace("&", "and")


def is_staff_auth_role(value: object) -> bool:
    return normalize_label(value) in STAFF_AUTH_ROLES


def normalize_staff_designation(value: object) -> str:
    normalized = normalize_label(value)
    return normalized if normalized in STAFF_DESIGNATIONS else normalized
