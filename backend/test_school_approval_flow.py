import asyncio
from copy import deepcopy
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

import server


def matches(document, query):
    for key, expected in query.items():
        if key == "$or":
            if not any(matches(document, option) for option in expected):
                return False
            continue
        actual = document.get(key)
        if isinstance(expected, dict):
            if "$in" in expected and actual not in expected["$in"]:
                return False
            if "$ne" in expected and actual == expected["$ne"]:
                return False
        elif actual != expected:
            return False
    return True


class Cursor:
    def __init__(self, documents):
        self.documents = documents

    def sort(self, *_args, **_kwargs):
        return self

    async def to_list(self, length):
        return deepcopy(self.documents[:length])


class Collection:
    def __init__(self, documents=None):
        self.documents = deepcopy(documents or [])

    def find(self, query, *_args, **_kwargs):
        return Cursor([doc for doc in self.documents if matches(doc, query)])

    async def find_one(self, query, *_args, **_kwargs):
        return next((doc for doc in self.documents if matches(doc, query)), None)

    async def insert_one(self, document):
        self.documents.append(deepcopy(document))

    async def update_one(self, query, update):
        document = await self.find_one(query)
        if document:
            document.update(update.get("$set", {}))

    async def update_many(self, query, update):
        for document in self.documents:
            if matches(document, query):
                document.update(update.get("$set", {}))


class ApprovalDatabase:
    def __init__(self):
        def pending(item_id, school_id="school-a", **extra):
            return {"id": item_id, "school_id": school_id, "approval_status": "pending", "created_at": "2026-07-24T10:00:00Z", **extra}

        self.users = Collection([
            pending("user-a", full_name="Teacher A", role="teacher", is_active=False),
            pending("user-b", "school-b", full_name="Teacher B", role="teacher", is_active=False),
        ])
        self.students = Collection([
            pending("student-a", full_name="Student A"),
            {"id": "fee-a", "school_id": "school-a", "approval_status": "approved", "fee_status_approval_status": "pending", "updated_at": "2026-07-24T10:00:00Z"},
        ])
        self.staff = Collection([])
        self.results = Collection([pending("result-a")])
        self.attendance = Collection([pending("attendance-a")])
        self.payments = Collection([pending("payment-a")])
        self.announcements = Collection([pending("announcement-a", title="Notice")])
        self.inventory = Collection([pending("inventory-a")])
        self.finance_transactions = Collection([pending("transaction-a")])
        self.approval_requests = Collection([
            {"id": "request-a", "school_id": "school-a", "status": "pending", "request_type": "finance", "created_at": "2026-07-24T10:00:00Z"},
            {"id": "request-b", "school_id": "school-b", "status": "pending", "request_type": "finance", "created_at": "2026-07-24T10:00:00Z"},
        ])
        self.approvals = Collection([])


def admin(school_id="school-a"):
    return {"role": "school_admin", "school_id": school_id, "user_id": "admin-a"}


def test_pending_approvals_include_every_source_and_are_tenant_scoped(monkeypatch):
    database = ApprovalDatabase()
    monkeypatch.setattr(server, "db", database)

    response = asyncio.run(server.get_pending_items(admin()))
    approvals = response["data"]["approvals"]

    assert {item["item_type"] for item in approvals} == {
        "users", "students", "fee_status", "results", "attendance", "payments",
        "announcements", "inventory", "finance_transactions", "approval_requests",
    }
    assert all(item["school_id"] == "school-a" for item in approvals)
    assert not any(item["item_id"] in {"user-b", "request-b"} for item in approvals)


def test_approving_join_request_updates_user_and_removes_it_from_pending(monkeypatch):
    database = ApprovalDatabase()
    monkeypatch.setattr(server, "db", database)
    monkeypatch.setattr(server, "log_security_event", AsyncMock())

    result = asyncio.run(server.approve_item(
        "users", "user-a", server.ApprovalActionRequest(action="approved", reason="Verified"), admin()
    ))
    assert result["approval_status"] == "approved"
    user = asyncio.run(database.users.find_one({"id": "user-a", "school_id": "school-a"}))
    assert user["approval_status"] == "approved"
    assert user["status"] == "active"
    assert user["is_active"] is True

    pending = asyncio.run(server.get_pending_items(admin()))["data"]["approvals"]
    assert not any(item["item_id"] == "user-a" for item in pending)


def test_school_admin_cannot_process_another_schools_request(monkeypatch):
    database = ApprovalDatabase()
    monkeypatch.setattr(server, "db", database)
    monkeypatch.setattr(server, "log_security_event", AsyncMock())

    with pytest.raises(server.HTTPException) as exc:
        asyncio.run(server.approve_item(
            "users", "user-b", server.ApprovalActionRequest(action="rejected", reason="No"), admin()
        ))
    assert exc.value.status_code == 404
    other = asyncio.run(database.users.find_one({"id": "user-b", "school_id": "school-b"}))
    assert other["approval_status"] == "pending"


@pytest.mark.parametrize("role", ["teacher", "finance", "secretary", "supporting_staff"])
def test_staff_join_request_is_saved_pending_for_resolved_school(monkeypatch, role):
    database = ApprovalDatabase()
    database.users = Collection([])
    monkeypatch.setattr(server, "db", database)
    monkeypatch.setattr(server, "find_school_for_join", AsyncMock(return_value={
        "id": "school-a", "name": "School A", "fingerprint": "fp-a", "is_active": True,
    }))
    monkeypatch.setattr(server, "enforce_rate_limit", AsyncMock())
    monkeypatch.setattr(server, "request_fingerprint", lambda *_args: "join-test")
    monkeypatch.setattr(server, "log_security_event", AsyncMock())

    response = asyncio.run(server.join_school({
        "school_code": "SMH-AB12CD34EF",
        "email": f"{role}@example.com",
        "password": "ValidPass123!",
        "full_name": f"New {role}",
        "role": role,
    }, SimpleNamespace()))

    created = database.users.documents[0]
    assert response["user"]["school_id"] == "school-a"
    assert created["school_id"] == "school-a"
    assert created["approval_status"] == "pending"
    assert created["is_active"] is False
    assert created["password_hash"] != "ValidPass123!"
