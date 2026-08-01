import pytest
from fastapi import HTTPException

from security_controls import (
    can_manage_staff,
    hash_one_time_code,
    sign_media_asset,
    redact_sensitive,
    require_same_school,
    same_school,
    validate_magic_bytes,
    verify_one_time_code,
    verify_media_signature,
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


def test_one_time_codes_are_hashed_and_compared_safely():
    digest = hash_one_time_code("307582")
    assert digest != "307582"
    assert len(digest) == 64
    assert verify_one_time_code("307582", digest)
    assert not verify_one_time_code("000000", digest)


def test_media_signatures_bind_asset_to_school(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "test-secret-key-that-is-long-enough-for-hmac")
    signature = sign_media_asset("asset-1", "school-a")
    assert verify_media_signature("asset-1", "school-a", signature)
    assert not verify_media_signature("asset-1", "school-b", signature)
    assert not verify_media_signature("asset-2", "school-a", signature)
