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


def test_upload_storage_usage_can_be_scoped_to_school(tmp_path, monkeypatch):
    upload_root = tmp_path / "uploads"
    school_dir = upload_root / "school-1" / "document"
    school_dir.mkdir(parents=True)
    (school_dir / "file.txt").write_bytes(b"12345")
    (upload_root / "platform").mkdir()

    monkeypatch.setattr(platform, "UPLOAD_ROOT", Path(upload_root))

    scoped = platform.upload_storage_usage("school-1")
    total = platform.upload_storage_usage()

    assert scoped["files"] == 1
    assert total["files"] == 1
