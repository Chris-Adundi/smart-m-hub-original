import asyncio
import time
from types import SimpleNamespace

import auth
import database
import server
from services import dashboard_summaries
from services import external_notifications


class DelayedCountCollection:
    async def count_documents(self, _query):
        await asyncio.sleep(0.03)
        return 1


class SummaryCollection:
    def __init__(self):
        self.saved = None

    async def update_one(self, _query, update, upsert=False):
        self.saved = update["$set"]


def test_api_and_auth_share_one_mongo_pool():
    assert server.client is database.client
    assert auth.client is database.client
    assert server.db is database.db
    assert auth.db is database.db


def test_mongo_pool_has_bounded_wait_and_retry_options():
    options = database.mongo_client_options()
    assert options["maxPoolSize"] > 0
    assert options["waitQueueTimeoutMS"] > 0
    assert options["maxIdleTimeMS"] > 0
    assert options["retryReads"] is True
    assert options["retryWrites"] is True


def test_dashboard_summary_counts_run_concurrently():
    delayed = DelayedCountCollection()
    fake_db = SimpleNamespace(
        students=delayed,
        users=delayed,
        attendance=delayed,
        results=delayed,
        payments=delayed,
        announcements=delayed,
        inventory=delayed,
        dashboard_summaries=SummaryCollection(),
    )
    started = time.perf_counter()
    summary = asyncio.run(dashboard_summaries.rebuild_school_dashboard_summary(fake_db, "school-a"))
    elapsed = time.perf_counter() - started
    assert elapsed < 0.15
    assert summary["total_students"] == 1
    assert summary["pending_operations"] == 5


class DelayedEmailProvider:
    async def send(self, **_kwargs):
        await asyncio.sleep(0.04)
        return "accepted"


class DeliveryLog:
    async def insert_many(self, _records):
        return None


def test_notification_delivery_uses_bounded_concurrency(monkeypatch):
    monkeypatch.setenv("NOTIFICATION_SEND_CONCURRENCY", "3")
    monkeypatch.setattr(external_notifications, "get_email_provider", lambda: DelayedEmailProvider())
    recipients = [
        {"id": str(index), "school_id": "school-a", "email": f"parent{index}@example.com"}
        for index in range(6)
    ]
    started = time.perf_counter()
    result = asyncio.run(external_notifications.dispatch_notifications(
        SimpleNamespace(notification_deliveries=DeliveryLog()),
        school_id="school-a",
        title="Notice",
        message="Message",
        recipients=recipients,
        channels=["email"],
        event_type="test",
    ))
    elapsed = time.perf_counter() - started
    assert elapsed < 0.2
    assert result["succeeded"] == 6
