import asyncio
from copy import deepcopy

import pytest

import server
from routes import platform


class Result:
    modified_count = 1


class DeleteCollection:
    def __init__(self, documents=None):
        self.documents = deepcopy(documents or [])

    async def find_one(self, _query, *_args):
        return next((item for item in self.documents if not item.get("deleted_at")), None)

    async def update_one(self, _query, update):
        self.documents[0].update(update.get("$set", {}))
        return Result()

    async def update_many(self, query, update):
        for item in self.documents:
            if not query.get("school_id") or item.get("school_id") == query["school_id"]:
                item.update(update.get("$set", {}))
        return Result()

    async def insert_one(self, document):
        self.documents.append(deepcopy(document))


class DeleteDb:
    def __init__(self):
        self.schools = DeleteCollection([{"_id": "mongo-a", "id": "school-a", "name": "School A", "is_active": True}])
        self.users = DeleteCollection([{"id": "user-a", "school_id": "school-a", "is_active": True}])
        self.auth_sessions = DeleteCollection([{"id": "session-a", "school_id": "school-a", "revoked": False}])
        self.audit_logs = DeleteCollection([])


def test_only_super_admin_can_use_school_deletion_dependency():
    with pytest.raises(platform.HTTPException) as exc:
        asyncio.run(platform.require_super_admin({"role": "school_admin"}))
    assert exc.value.status_code == 403


def test_school_deletion_creates_tombstone_and_revokes_tenant_access(monkeypatch):
    database = DeleteDb()
    monkeypatch.setattr(platform, "db", database)
    response = asyncio.run(platform.delete_school("school-a", {"role": "super_admin", "user_id": "owner", "email": "owner@example.com"}))
    assert response["school_id"] == "school-a"
    assert database.schools.documents[0]["status"] == "deleted"
    assert database.schools.documents[0]["is_active"] is False
    assert database.schools.documents[0]["deleted_at"]
    assert database.users.documents[0]["is_active"] is False
    assert database.users.documents[0]["is_blocked"] is True
    assert database.auth_sessions.documents[0]["revoked"] is True
    assert database.audit_logs.documents[0]["action"] == "school_deleted"


class Tracker:
    active = 0
    maximum = 0

    async def delay(self):
        self.active += 1
        self.maximum = max(self.maximum, self.active)
        await asyncio.sleep(0.005)
        self.active -= 1


class PortalCursor:
    def __init__(self, documents, tracker):
        self.documents = deepcopy(documents)
        self.tracker = tracker

    def sort(self, *_args):
        return self

    async def to_list(self, length):
        await self.tracker.delay()
        return self.documents[:length]


class PortalCollection:
    def __init__(self, documents, tracker):
        self.documents = documents
        self.tracker = tracker

    def find(self, query, *_args):
        school_id = query.get("school_id")
        docs = [item for item in self.documents if not school_id or item.get("school_id") == school_id]
        if "student_id" in query:
            docs = [item for item in docs if item.get("student_id") == query["student_id"]]
        return PortalCursor(docs, self.tracker)

    async def find_one(self, query, *_args):
        await self.tracker.delay()
        return next((item for item in self.documents if item.get("id") == query.get("id")), None)


class PortalDb:
    def __init__(self):
        tracker = Tracker()
        self.tracker = tracker
        student = {
            "id": "student-a", "school_id": "school-a", "full_name": "Student A",
            "admission_number": "ADM-A", "class_name": "Grade 4", "approval_status": "approved",
            "guardian_email": "parent@example.com", "fee_status_visible": True,
        }
        self.students = PortalCollection([student, {**student, "id": "student-b", "school_id": "school-b"}], tracker)
        self.results = PortalCollection([{"id": "result-a", "school_id": "school-a", "student_id": "student-a", "result_type": "exam"}], tracker)
        self.attendance = PortalCollection([], tracker)
        self.payments = PortalCollection([], tracker)
        self.schools = PortalCollection([{"id": "school-a", "name": "School A"}], tracker)
        self.fee_structures = PortalCollection([], tracker)
        self.announcements = PortalCollection([], tracker)
        self.assessment_reports = PortalCollection([], tracker)
        self.notifications = PortalCollection([], tracker)
        self.exams = PortalCollection([], tracker)


def test_portal_is_view_only_tenant_scoped_and_parallelized(monkeypatch):
    database = PortalDb()
    monkeypatch.setattr(server, "db", database)
    response = asyncio.run(server.get_my_portal_data(
        selected_student_id="student-b",
        current_user={
            "role": "parent", "school_id": "school-a", "user_id": "parent-a",
            "email": "parent@example.com", "student_id": "student-a",
        },
    ))
    assert response["student"]["id"] == "student-a"
    assert all(child["school_id"] == "school-a" for child in response["children"])
    assert all(result["school_id"] == "school-a" for result in response["results"])
    assert database.tracker.maximum > 1


def test_non_portal_role_cannot_read_parent_student_bundle(monkeypatch):
    monkeypatch.setattr(server, "db", PortalDb())
    with pytest.raises(server.HTTPException) as exc:
        asyncio.run(server.get_my_portal_data(current_user={"role": "school_admin", "school_id": "school-a"}))
    assert exc.value.status_code == 403


def test_parent_student_roles_cannot_create_or_update_support(monkeypatch):
    monkeypatch.setattr(server, "db", PortalDb())
    user = {"role": "parent", "school_id": "school-a", "user_id": "parent-a"}
    with pytest.raises(server.HTTPException) as create_exc:
        asyncio.run(server.create_school_support_ticket(
            request=object(),
            data=server.SupportTicketCreateRequest(subject="Change data", message="Please update"),
            current_user=user,
        ))
    assert create_exc.value.status_code == 403

    with pytest.raises(server.HTTPException) as update_exc:
        asyncio.run(server.update_school_support_ticket("ticket-a", {"reply": "message"}, user))
    assert update_exc.value.status_code == 403


def test_student_navigation_has_only_the_student_portal_entry():
    from pathlib import Path

    root = Path(__file__).resolve().parents[1]
    menu = (root / "frontend" / "src" / "components" / "layouts" / "DashboardLayout.js").read_text(encoding="utf-8")
    permissions = (root / "frontend" / "src" / "utils" / "roleRoutes.js").read_text(encoding="utf-8")
    assert 'roles: ["student"]' in menu
    assert 'roles: ["school_admin", "teacher", "student"]' not in menu
    assert 'roles: ["school_admin", "secretary", "teacher", "finance", "student"]' not in menu
    assert 'timetable: ["super_admin", "school_admin", "teacher", "student"]' not in permissions
    assert 'support: ["school_admin", "teacher", "finance", "secretary", "student", "parent"]' not in permissions
