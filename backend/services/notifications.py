from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Iterable, Optional

from services.job_queue import enqueue_job


def now_utc():
    return datetime.now(timezone.utc)


async def queue_notification_batch(
    db: Any,
    *,
    school_id: str,
    notifications: Iterable[dict],
    channels: Optional[list[str]] = None,
    requested_by: Optional[str] = None,
    async_delivery: bool = True,
) -> list[dict]:
    channels = channels or ["in_app"]
    now = now_utc()
    docs = []
    deliveries = []
    for item in notifications:
        notification = {
            "id": item.get("id") or str(uuid.uuid4()),
            "school_id": school_id,
            "title": item.get("title"),
            "message": item.get("message"),
            "recipient_type": item.get("recipient_type"),
            "recipient_id": item.get("recipient_id"),
            "student_id": item.get("student_id"),
            "report_id": item.get("report_id"),
            "channels": channels,
            "read": False,
            "created_at": now,
        }
        docs.append(notification)
        for channel in channels:
            deliveries.append({
                "id": str(uuid.uuid4()),
                "school_id": school_id,
                "notification_id": notification["id"],
                "channel": channel,
                "recipient_type": notification.get("recipient_type"),
                "status": "queued",
                "attempts": 0,
                "created_at": now,
                "updated_at": now,
            })
    if docs:
        await db.notifications.insert_many(docs)
    if deliveries:
        await db.notification_deliveries.insert_many(deliveries)
    if async_delivery and docs:
        await enqueue_job(
            db,
            job_type="notification_delivery",
            school_id=school_id,
            payload={
                "channel": ",".join(channels),
                "notification_ids": [doc["id"] for doc in docs],
                "delivery_ids": [delivery["id"] for delivery in deliveries],
            },
            requested_by=requested_by,
        )
    return docs
