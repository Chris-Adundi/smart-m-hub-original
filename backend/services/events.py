from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Optional


def now_utc():
    return datetime.now(timezone.utc)


async def record_event(
    db: Any,
    *,
    event_type: str,
    school_id: Optional[str],
    actor_id: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    payload: Optional[dict] = None,
) -> dict:
    event = {
        "id": str(uuid.uuid4()),
        "event_type": event_type,
        "school_id": school_id,
        "actor_id": actor_id,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "payload": payload or {},
        "created_at": now_utc(),
    }
    await db.event_log.insert_one(event)
    return event
