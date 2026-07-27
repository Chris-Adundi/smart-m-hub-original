from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
import asyncio


def _now():
    return datetime.now(timezone.utc)


async def rebuild_school_dashboard_summary(db: Any, school_id: str) -> dict:
    school_filter = {"school_id": str(school_id)}
    now = _now()
    (
        total_students,
        total_teachers,
        total_staff,
        pending_users,
        approved_users,
        rejected_users,
        suspended_users,
        present_today,
        pending_results,
        pending_attendance,
        pending_payments,
        pending_announcements,
        pending_inventory,
    ) = await asyncio.gather(
        db.students.count_documents(school_filter),
        db.users.count_documents({**school_filter, "role": "teacher"}),
        db.users.count_documents({**school_filter, "role": {"$in": ["teacher", "secretary", "finance", "supporting_staff"]}}),
        db.users.count_documents({**school_filter, "approval_status": "pending"}),
        db.users.count_documents({**school_filter, "approval_status": "approved"}),
        db.users.count_documents({**school_filter, "approval_status": "rejected"}),
        db.users.count_documents({**school_filter, "is_suspended": True}),
        db.attendance.count_documents({**school_filter, "status": "present", "archived": {"$ne": True}}),
        db.results.count_documents({**school_filter, "approval_status": "pending"}),
        db.attendance.count_documents({**school_filter, "approval_status": "pending", "archived": {"$ne": True}}),
        db.payments.count_documents({**school_filter, "approval_status": "pending"}),
        db.announcements.count_documents({**school_filter, "approval_status": "pending"}),
        db.inventory.count_documents({**school_filter, "approval_status": "pending"}),
    )
    summary = {
        "id": f"dashboard:{school_id}",
        "school_id": str(school_id),
        "total_students": total_students,
        "total_teachers": total_teachers,
        "total_staff": total_staff,
        "pending_users": pending_users,
        "approved_users": approved_users,
        "rejected_users": rejected_users,
        "suspended_users": suspended_users,
        "present_today": present_today,
        "pending_results": pending_results,
        "pending_attendance": pending_attendance,
        "pending_payments": pending_payments,
        "pending_announcements": pending_announcements,
        "pending_inventory": pending_inventory,
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
