import pytest
from fastapi import HTTPException

from security_controls import (
    can_manage_staff,
    redact_sensitive,
    require_same_school,
    same_school,
    validate_magic_bytes,
)


def test_same_school_allows_super_admin_and_matching_school():
    assert same_school({"role": "super_admin"}, "school-b")
    assert same_school({"role": "school_admin", "school_id": "school-a"}, "school-a")
    assert not same_school({"role": "school_admin", "school_id": "school-a"}, "school-b")


def test_require_same_school_blocks_cross_tenant_access():
    with pytest.raises(HTTPException):
        require_same_school({"role": "teacher", "school_id": "school-a"}, "school-b")


def test_can_manage_staff_is_school_admin_scoped():
    target = {"role": "teacher", "school_id": "school-a"}
    assert can_manage_staff({"role": "school_admin", "school_id": "school-a"}, target)
    assert not can_manage_staff({"role": "school_admin", "school_id": "school-b"}, target)
    assert not can_manage_staff({"role": "teacher", "school_id": "school-a"}, target)


def test_redact_sensitive_recurses_through_payloads():
    payload = {
        "email": "user@example.com",
        "password_hash": "hash",
        "nested": {"refresh_token": "token"},
        "items": [{"mfa_secret": "secret"}],
    }
    assert redact_sensitive(payload) == {
        "email": "user@example.com",
        "password_hash": "[REDACTED]",
        "nested": {"refresh_token": "[REDACTED]"},
        "items": [{"mfa_secret": "[REDACTED]"}],
    }


def test_validate_magic_bytes_rejects_mismatched_file_type():
    validate_magic_bytes(b"%PDF-1.7", "application/pdf")
    with pytest.raises(HTTPException):
        validate_magic_bytes(b"<script>alert(1)</script>", "application/pdf")
