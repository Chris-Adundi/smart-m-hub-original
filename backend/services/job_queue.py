from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from pymongo import ReturnDocument


def now_utc():
    return datetime.now(timezone.utc)


async def enqueue_job(
    db: Any,
    *,
    job_type: str,
    school_id: Optional[str],
    payload: dict,
    requested_by: Optional[str] = None,
    priority: str = "normal",
    collection_name: str = "jobs",
) -> dict:
    now = now_utc()
    job = {
        "id": str(uuid.uuid4()),
        "job_type": job_type,
        "school_id": school_id,
        "payload": payload,
        "status": "queued",
        "priority": priority,
        "requested_by": requested_by,
        "attempts": 0,
        "available_at": now,
        "created_at": now,
        "updated_at": now,
    }
    await db[collection_name].insert_one(job)
    return job


async def claim_next_job(db: Any, *, worker_id: str, job_types: list[str], collection_name: str = "jobs") -> Optional[dict]:
    now = now_utc()
    return await db[collection_name].find_one_and_update(
        {
            "job_type": {"$in": job_types},
            "status": "queued",
            "available_at": {"$lte": now},
        },
        {
            "$set": {
                "status": "running",
                "worker_id": worker_id,
                "started_at": now,
                "updated_at": now,
            },
            "$inc": {"attempts": 1},
        },
        sort=[("priority", -1), ("created_at", 1)],
        return_document=ReturnDocument.AFTER,
    )


async def complete_job(db: Any, job: dict, result: Optional[dict] = None, *, collection_name: str = "jobs") -> None:
    await db[collection_name].update_one(
        {"id": job["id"]},
        {"$set": {"status": "completed", "result": result or {}, "completed_at": now_utc(), "updated_at": now_utc()}},
    )


async def fail_job(db: Any, job: dict, error: str, *, max_attempts: int = 3, collection_name: str = "jobs") -> None:
    attempts = int(job.get("attempts") or 0)
    status = "failed" if attempts >= max_attempts else "queued"
    delay = min(300, 30 * max(attempts, 1))
    await db[collection_name].update_one(
        {"id": job["id"]},
        {"$set": {
            "status": status,
            "last_error": str(error)[:1000],
            "available_at": now_utc() + timedelta(seconds=delay),
            "updated_at": now_utc(),
        }},
    )
