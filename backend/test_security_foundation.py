from datetime import date, datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

from auth import (
    create_access_token,
    decode_token,
    login_attempt_key,
    normalize_role,
    validate_password_strength,
)
from routes.platform import billing_due_date, invoice_number, parse_date


def test_normalize_role_aliases():
    assert normalize_role("Admin") == "school_admin"
    assert normalize_role("platform-admin") == "super_admin"
    assert normalize_role("Bursar") == "finance"
    assert normalize_role("unknown") == ""


def test_validate_password_strength_rejects_weak_passwords():
    with pytest.raises(HTTPException):
        validate_password_strength("short")

    with pytest.raises(HTTPException):
        validate_password_strength("lowercaseonly")

    with pytest.raises(HTTPException):
        validate_password_strength("NoNumberHere")


def test_validate_password_strength_accepts_strong_password():
    validate_password_strength("SmartHub2026")


def test_access_tokens_require_expected_type_and_issuer():
    token = create_access_token(
        {"user_id": "user-1", "role": "school_admin", "school_id": "school-1"},
        expires_delta=timedelta(minutes=5),
    )

    payload = decode_token(token)

    assert payload["user_id"] == "user-1"
    assert payload["role"] == "school_admin"
    assert payload["iss"] == "smart-m-hub"
    assert payload["typ"] == "access"
    assert payload["jti"]


def test_login_attempt_key_normalizes_email_and_school_code():
    assert login_attempt_key(" Admin@School.COM ", " smh001 ") == "admin@school.com|SMH001"


def test_parse_date_accepts_datetime_and_iso_strings():
    assert parse_date(datetime(2026, 7, 8, tzinfo=timezone.utc)) == date(2026, 7, 8)
    assert parse_date("2026-07-08T10:00:00+00:00") == date(2026, 7, 8)
    assert parse_date("2026-07-08") == date(2026, 7, 8)
    assert parse_date("not-a-date") is None


def test_billing_due_date_clamps_month_end():
    assert billing_due_date(date(2026, 2, 10), 31) == date(2026, 2, 28)
    assert billing_due_date(date(2026, 7, 10), 8) == date(2026, 7, 8)


def test_invoice_number_is_stable_for_school_month():
    assert invoice_number("smh 001", "2026-07") == "SMH-SUB-SMH001-202607"
