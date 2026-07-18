from __future__ import annotations

import hashlib
import hmac
import json
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from services.job_queue import enqueue_job


def now_utc():
    return datetime.now(timezone.utc)


def canonical_payload(payload: dict) -> bytes:
    return json.dumps(payload or {}, sort_keys=True, default=str, separators=(",", ":")).encode("utf-8")


def sign_webhook_payload(payload: dict, secret: str) -> str:
    return hmac.new(secret.encode("utf-8"), canonical_payload(payload), hashlib.sha256).hexdigest()


async def queue_webhook_event(
    db: Any,
    *,
    school_id: Optional[str],
    event_type: str,
    payload: dict,
    requested_by: Optional[str] = None,
) -> dict:
    event = {
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "event_type": event_type,
        "payload": payload,
        "status": "queued",
        "attempts": 0,
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }
    await db.webhook_events.insert_one(event)
    await enqueue_job(
        db,
        job_type="webhook_delivery",
        school_id=school_id,
        payload={"webhook_event_id": event["id"]},
        requested_by=requested_by,
    )
    return event
