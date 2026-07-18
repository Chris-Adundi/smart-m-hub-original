from datetime import datetime, timezone
from pathlib import Path

from bson import ObjectId

from routes import platform


def test_school_lookup_supports_uuid_and_object_id():
    object_id = str(ObjectId())

    uuid_lookup = platform.school_lookup("school-123")
    object_lookup = platform.school_lookup(object_id)

    assert uuid_lookup == {"$or": [{"id": "school-123"}]}
    assert object_lookup["$or"][0] == {"id": object_id}
    assert object_lookup["$or"][1] == {"_id": ObjectId(object_id)}


def test_status_breakdown_counts_unknown_values():
    rows = platform.status_breakdown(
        [{"status": "active"}, {"status": "active"}, {"status": None}],
        "status",
    )

    assert {"status": "active", "count": 2} in rows
    assert {"status": "unknown", "count": 1} in rows


def test_is_today_handles_string_and_datetime_values():
    today = "2026-07-08"

    assert platform.is_today("2026-07-08T10:00:00+00:00", today)
    assert platform.is_today(datetime(2026, 7, 8, tzinfo=timezone.utc), today)
    assert not platform.is_today("2026-07-07T10:00:00+00:00", today)


def test_upload_storage_usage_can_be_scoped_to_school(monkeypatch):
    upload_root = Path(__file__).with_name("_platform_uploads_test")
    school_dir = upload_root / "school-1" / "document"
    try:
        school_dir.mkdir(parents=True, exist_ok=True)
        (school_dir / "file.txt").write_bytes(b"12345")
        (upload_root / "platform").mkdir(exist_ok=True)

        monkeypatch.setattr(platform, "UPLOAD_ROOT", Path(upload_root))

        scoped = platform.upload_storage_usage("school-1")
        total = platform.upload_storage_usage()

        assert scoped["files"] == 1
        assert total["files"] == 1
    finally:
        if upload_root.exists():
            for path in sorted(upload_root.rglob("*"), reverse=True):
                if path.is_file():
                    path.unlink()
                else:
                    path.rmdir()
            upload_root.rmdir()


def test_diagnostic_from_error_includes_review_notes():
    diagnostic = platform.diagnostic_from_error(
        {
            "id": "error-1",
            "action": "frontend_error",
            "school_id": "school-1",
            "performed_by": "admin@example.com",
            "timestamp": "2026-07-09T10:00:00+00:00",
            "metadata": {
                "message": "Failed request",
                "severity": "high",
                "route": "/payments",
                "affected_file": "FeesPage.js",
                "stack_trace": "Error: Failed request",
                "suggested_fix": "Validate payment payload",
            },
        },
        {
            "status": "reviewed",
            "fix_notes": "Payload validation added",
            "reviewed_by": "owner@example.com",
        },
    )

    assert diagnostic["source_id"] == "error-1"
    assert diagnostic["status"] == "reviewed"
    assert diagnostic["severity"] == "high"
    assert diagnostic["route_or_component"] == "/payments"
    assert diagnostic["affected_file"] == "FeesPage.js"
    assert diagnostic["fix_notes"] == "Payload validation added"
