from datetime import datetime, timezone

import pytest
from fastapi import HTTPException

from db_controls import apply_query_controls, bounded_limit, bounded_page, exclude_private_projection, pagination_meta, skip_for_page, as_utc


class FakeCursor:
    def __init__(self):
        self.calls = []

    def sort(self, value):
        self.calls.append(("sort", value))
        return self

    def skip(self, value):
        self.calls.append(("skip", value))
        return self

    def limit(self, value):
        self.calls.append(("limit", value))
        return self

    def max_time_ms(self, value):
        self.calls.append(("max_time_ms", value))
        return self


def test_bounded_pagination_defaults_and_caps():
    assert bounded_page(None) == 1
    assert bounded_limit(None) == 50
    assert bounded_limit(999, maximum=200) == 200
    assert skip_for_page(3, 25) == 50


def test_bounded_pagination_rejects_invalid_values():
    with pytest.raises(HTTPException):
        bounded_page(0)
    with pytest.raises(HTTPException):
        bounded_limit(0)


def test_pagination_meta_reports_has_next():
    meta = pagination_meta(page=2, limit=25, total=80, returned=25)
    assert meta["has_next"] is True
    assert meta["returned"] == 25


def test_private_projection_excludes_sensitive_fields():
    projection = exclude_private_projection()
    assert projection["password_hash"] == 0
    assert projection["mfa_secret"] == 0


def test_as_utc_normalizes_string_dates():
    value = as_utc("2026-07-18T10:00:00+00:00")
    assert isinstance(value, datetime)
    assert value.tzinfo == timezone.utc


def test_apply_query_controls_sets_sort_window_and_timeout():
    cursor = FakeCursor()
    assert apply_query_controls(cursor, page=2, limit=25, sort=[("created_at", -1)], max_time_ms=3000) is cursor
    assert cursor.calls == [
        ("sort", [("created_at", -1)]),
        ("skip", 25),
        ("limit", 25),
        ("max_time_ms", 3000),
    ]
