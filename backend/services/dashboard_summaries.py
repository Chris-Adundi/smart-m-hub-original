from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


def _now():
    return datetime.now(timezone.utc)


async def rebuild_school_dashboard_summary(db: Any, school_id: str) -> dict:
    school_filter = {"school_id": str(school_id)}
    now = _now()
    summary = {
        "id": f"dashboard:{school_id}",
        "school_id": str(school_id),
        "total_students": await db.students.count_documents(school_filter),
        "total_teachers": await db.users.count_documents({**school_filter, "role": "teacher"}),
        "total_staff": await db.users.count_documents({**school_filter, "role": {"$in": ["teacher", "secretary", "finance", "supporting_staff"]}}),
        "pending_users": await db.users.count_documents({**school_filter, "approval_status": "pending"}),
        "approved_users": await db.users.count_documents({**school_filter, "approval_status": "approved"}),
        "rejected_users": await db.users.count_documents({**school_filter, "approval_status": "rejected"}),
        "suspended_users": await db.users.count_documents({**school_filter, "is_suspended": True}),
        "present_today": await db.attendance.count_documents({**school_filter, "status": "present", "archived": {"$ne": True}}),
        "pending_results": await db.results.count_documents({**school_filter, "approval_status": "pending"}),
        "pending_attendance": await db.attendance.count_documents({**school_filter, "approval_status": "pending", "archived": {"$ne": True}}),
        "pending_payments": await db.payments.count_documents({**school_filter, "approval_status": "pending"}),
        "pending_announcements": await db.announcements.count_documents({**school_filter, "approval_status": "pending"}),
        "pending_inventory": await db.inventory.count_documents({**school_filter, "approval_status": "pending"}),
        "updated_at": now,
    }
    summary["pending_operations"] = (
        summary["pending_results"]
        + summary["pending_attendance"]
        + summary["pending_payments"]
        + summary["pending_announcements"]
        + summary["pending_inventory"]
    )
    await db.dashboard_summaries.update_one(
        {"id": summary["id"]},
        {"$set": summary, "$setOnInsert": {"created_at": now}},
        upsert=True,
    )
    return summary


async def get_school_dashboard_summary(db: Any, school_id: str, *, max_age_seconds: int = 300) -> dict:
    existing = await db.dashboard_summaries.find_one({"id": f"dashboard:{school_id}"}, {"_id": 0})
    if existing:
        updated_at = existing.get("updated_at")
        if isinstance(updated_at, str):
            updated_at = datetime.fromisoformat(updated_at.replace("Z", "+00:00"))
        if updated_at and updated_at.tzinfo is None:
            updated_at = updated_at.replace(tzinfo=timezone.utc)
        if updated_at and (_now() - updated_at).total_seconds() <= max_age_seconds:
            existing["from_summary_cache"] = True
            return existing
    summary = await rebuild_school_dashboard_summary(db, school_id)
    summary["from_summary_cache"] = False
    return summary
