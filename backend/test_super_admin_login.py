from unittest.mock import AsyncMock, MagicMock

from fastapi.testclient import TestClient

import server


EMAIL = "chrisadundi1@gmail.com"
PASSWORD = "C30758255c"


def test_exact_super_admin_credentials_login_after_reconciliation(monkeypatch):
    password_hash = server.hash_password(PASSWORD)
    reconciled_user = {
        "id": "super-admin-test-id",
        "email": EMAIL,
        "password_hash": password_hash,
        "role": "super_admin",
        "status": "active",
        "approval_status": "approved",
        "is_active": True,
        "is_suspended": False,
        "is_blocked": False,
        "school_id": None,
        "super_admin_guard": "singleton",
    }

    test_db = MagicMock()
    test_db.users.find_one = AsyncMock(return_value=reconciled_user)
    test_db.users.update_one = AsyncMock()
    test_db.auth_sessions.insert_one = AsyncMock()
    monkeypatch.setattr(server, "db", test_db)
    monkeypatch.setattr(server, "enforce_rate_limit", AsyncMock())
    monkeypatch.setattr(server, "assert_login_not_locked", AsyncMock())
    monkeypatch.setattr(server, "clear_login_failures", AsyncMock())
    monkeypatch.setattr(server, "log_security_event", AsyncMock())
    monkeypatch.setenv("SUPER_ADMIN_EMAIL", EMAIL)
    monkeypatch.setenv("SUPER_ADMIN_PASSWORD", PASSWORD)

    response = TestClient(server.app).post(
        "/api/auth/login",
        json={"email": f"  {EMAIL.upper()}  ", "password": PASSWORD},
    )

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["user"]["email"] == EMAIL
    assert payload["user"]["role"] == "super_admin"
    assert payload["user"]["school_id"] is None
    assert payload["access_token"]
    query = test_db.users.find_one.await_args.args[0]
    assert query["email"]["$options"] == "i"
