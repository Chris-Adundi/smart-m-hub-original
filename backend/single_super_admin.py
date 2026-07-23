from __future__ import annotations

import os
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Callable


ELEVATED_ROLE_ALIASES = {
    "super_admin",
    "superadmin",
    "super-admin",
    "platform_admin",
    "platformadmin",
    "platform-admin",
    "developer",
    "developer_admin",
}


def canonical_super_admin_email() -> str:
    email = os.getenv("SUPER_ADMIN_EMAIL", "").strip().lower()
    if not email:
        raise RuntimeError("SUPER_ADMIN_EMAIL is required")
    return email


def is_elevated_role(role: Any) -> bool:
    return str(role or "").strip().lower().replace(" ", "_") in ELEVATED_ROLE_ALIASES


def is_canonical_super_admin(user: dict | None) -> bool:
    if not user or not is_elevated_role(user.get("role")):
        return False
    return str(user.get("email") or "").strip().lower() == canonical_super_admin_email()


async def reconcile_single_super_admin(db, hash_password: Callable[[str], str]) -> dict:
    """Enforce exactly one active elevated identity without persisting plaintext secrets."""
    email = canonical_super_admin_email()
    password = os.getenv("SUPER_ADMIN_PASSWORD")
    now = datetime.now(timezone.utc)

    elevated_pattern = "^(?:" + "|".join(re.escape(role) for role in sorted(ELEVATED_ROLE_ALIASES)) + ")$"
    elevated_query = {"role": {"$regex": elevated_pattern, "$options": "i"}}
    disable_fields = {
        "is_active": False,
        "is_suspended": True,
        "approval_status": "deactivated",
        "status": "deactivated",
        "deactivation_reason": "Only the configured Smart M Hub developer account is permitted",
        "updated_at": now,
    }
    await db.users.update_many(
        {"$and": [elevated_query, {"email": {"$not": {"$regex": f"^{re.escape(email)}$", "$options": "i"}}}]},
        {"$set": disable_fields, "$unset": {"super_admin_guard": ""}},
    )

    matches = await db.users.find({"email": {"$regex": f"^{re.escape(email)}$", "$options": "i"}}).to_list(length=100)
    canonical = matches[0] if matches else None
    if len(matches) > 1:
        duplicate_ids = [item["_id"] for item in matches[1:] if item.get("_id") is not None]
        if duplicate_ids:
            await db.users.update_many(
                {"_id": {"$in": duplicate_ids}},
                {"$set": disable_fields, "$unset": {"super_admin_guard": ""}},
            )

    updates = {
        "email": email,
        "role": "super_admin",
        "full_name": (canonical or {}).get("full_name") or "Smart M Hub Developer",
        "school_id": None,
        "approval_status": "approved",
        "status": "active",
        "is_active": True,
        "is_suspended": False,
        "is_blocked": False,
        "super_admin_guard": "singleton",
        "updated_at": now,
    }
    if password:
        updates["password_hash"] = hash_password(password)
        updates["password_rotated_at"] = now
    elif not canonical or not (canonical.get("password_hash") or canonical.get("hashed_password")):
        raise RuntimeError("SUPER_ADMIN_PASSWORD is required to create the Smart M Hub developer account")

    if canonical:
        await db.users.update_one({"_id": canonical["_id"]}, {"$set": updates, "$unset": {"hashed_password": ""}})
        user_id = str(canonical.get("id") or canonical["_id"])
    else:
        user_id = str(uuid.uuid4())
        updates.update({"id": user_id, "created_at": now})
        await db.users.insert_one(updates)

    await db.users.create_index(
        [("super_admin_guard", 1)],
        unique=True,
        partialFilterExpression={"super_admin_guard": "singleton"},
        name="single_super_admin_guard_idx",
    )
    return {"id": user_id, "email": email}
