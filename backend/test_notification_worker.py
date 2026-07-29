import asyncio
from types import SimpleNamespace

import worker


def test_external_notification_worker_delivers_queued_batch():
    captured = {}

    async def dispatch(_db, **kwargs):
        captured.update(kwargs)
        return {"total": 2, "succeeded": 2, "failed": 0, "skipped": 0}

    server = SimpleNamespace(db=object(), dispatch_notifications=dispatch)
    job = {
        "id": "job-a",
        "school_id": "school-a",
        "requested_by": "admin-a",
        "payload": {
            "title": "Notice",
            "message": "School closes at 3 PM.",
            "recipients": [{"school_id": "school-a", "email": "parent@example.com"}],
            "channels": ["email"],
            "event_type": "school_notice",
        },
    }

    result = asyncio.run(worker.process_external_notification_delivery(server, job))

    assert result["succeeded"] == 2
    assert captured["school_id"] == "school-a"
    assert captured["force_delivery"] is True
    assert captured["requested_by"] == "admin-a"
