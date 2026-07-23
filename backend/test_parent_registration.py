from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

import server


PASSWORD = "Guardian123"
SCHOOL_CODE = "SMH-AB12CD34EF"
ACCESS_CODE = "STU-ABCDEFGH"


def configured_db(*, school=True, student=True, existing=None):
    database = MagicMock()
    school_doc = {
        "_id": "school-db-id", "id": "school-1", "name": "Test School", "school_code": SCHOOL_CODE,
        "is_active": True, "status": "active", "approval_status": "approved",
        "subscription_status": "active",
    } if school else None
    student_doc = {
        "id": "student-1", "school_id": "school-1", "student_access_code": ACCESS_CODE,
        "admission_number": "ADM-00001", "approval_status": "approved",
        "guardian_name": "Guardian One", "guardian_email": "guardian1@example.com",
        "secondary_guardian_name": "Guardian Two", "secondary_guardian_email": "Guardian2@Example.com",
    } if student else None
    database.schools.find_one = AsyncMock(return_value=school_doc)
    database.schools.update_one = AsyncMock()
    database.students.find_one = AsyncMock(return_value=student_doc)
    database.users.find_one = AsyncMock(return_value=existing)
    database.users.insert_one = AsyncMock()
    database.users.update_one = AsyncMock()
    database.auth_sessions.insert_one = AsyncMock()
    return database


def client_for(monkeypatch, database):
    monkeypatch.setattr(server, "db", database)
    monkeypatch.setattr(server, "enforce_rate_limit", AsyncMock())
    monkeypatch.setattr(server, "log_security_event", AsyncMock())
    monkeypatch.setattr(server, "assert_login_not_locked", AsyncMock())
    monkeypatch.setattr(server, "clear_login_failures", AsyncMock())
    monkeypatch.setenv("SUPER_ADMIN_EMAIL", "owner@example.com")
    return TestClient(server.app)


@pytest.mark.parametrize("email", ["guardian1@example.com", "GUARDIAN2@example.COM"])
def test_either_recorded_guardian_can_register_and_sign_in(monkeypatch, email):
    database = configured_db()
    client = client_for(monkeypatch, database)
    registration = client.post("/api/auth/register-parent", json={
        "school_code": SCHOOL_CODE.lower(),
        "student_access_code": ACCESS_CODE.lower(),
        "email": email,
        "password": PASSWORD,
        "confirm_password": PASSWORD,
    })
    assert registration.status_code == 200, registration.text
    created = database.users.insert_one.await_args.args[0]
    assert created["email"] == email.lower()
    assert created["student_id"] == "student-1"
    assert created["student_ids"] == ["student-1"]
    assert created["role"] == "parent"
    assert server.verify_password(PASSWORD, created["password_hash"])

    database.users.find_one = AsyncMock(return_value=created)
    login = client.post("/api/auth/login", json={
        "school_code": SCHOOL_CODE,
        "email": email,
        "password": PASSWORD,
    })
    assert login.status_code == 200, login.text
    assert login.json()["user"]["role"] == "parent"


def test_unrelated_guardian_email_is_rejected(monkeypatch):
    database = configured_db()
    response = client_for(monkeypatch, database).post("/api/auth/register-parent", json={
        "school_code": SCHOOL_CODE,
        "student_access_code": ACCESS_CODE,
        "email": "stranger@example.com",
        "password": PASSWORD,
        "confirm_password": PASSWORD,
    })
    assert response.status_code == 403
    assert "does not match" in response.json()["detail"]
    database.users.insert_one.assert_not_awaited()


def test_legacy_join_endpoint_cannot_bypass_guardian_email_verification(monkeypatch):
    database = configured_db()
    response = client_for(monkeypatch, database).post("/api/auth/join-school", json={
        "school_code": SCHOOL_CODE,
        "email": "stranger@example.com",
        "password": PASSWORD,
        "full_name": "Unrelated Person",
        "role": "parent",
        "child_name": "Student One",
        "child_admission_number": ACCESS_CODE,
    })
    assert response.status_code == 400
    assert "Parent/Guardian Sign Up" in response.json()["detail"]
    database.users.insert_one.assert_not_awaited()


@pytest.mark.parametrize("school_exists,student_exists,expected", [
    (False, True, "Invalid school code"),
    (True, False, "Invalid student access code"),
])
def test_school_and_student_access_codes_are_validated(monkeypatch, school_exists, student_exists, expected):
    database = configured_db(school=school_exists, student=student_exists)
    response = client_for(monkeypatch, database).post("/api/auth/register-parent", json={
        "school_code": SCHOOL_CODE,
        "student_access_code": ACCESS_CODE,
        "email": "guardian1@example.com",
        "password": PASSWORD,
        "confirm_password": PASSWORD,
    })
    assert response.status_code == 404
    assert expected in response.json()["detail"]
    database.users.insert_one.assert_not_awaited()
