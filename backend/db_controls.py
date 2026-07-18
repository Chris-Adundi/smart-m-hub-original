from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import HTTPException


DEFAULT_PAGE_SIZE = 50
MAX_PAGE_SIZE = 200
DEFAULT_QUERY_MAX_TIME_MS = 5_000


def bounded_limit(limit: Optional[int], *, default: int = DEFAULT_PAGE_SIZE, maximum: int = MAX_PAGE_SIZE) -> int:
    try:
        value = int(limit) if limit is not None else default
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="limit must be a number")
    if value < 1:
        raise HTTPException(status_code=400, detail="limit must be greater than zero")
    return min(value, maximum)


def bounded_page(page: Optional[int]) -> int:
    try:
        value = int(page) if page is not None else 1
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="page must be a number")
    if value < 1:
        raise HTTPException(status_code=400, detail="page must be greater than zero")
    return value


def skip_for_page(page: int, limit: int) -> int:
    return (page - 1) * limit


def pagination_meta(page: int, limit: int, total: Optional[int] = None, returned: Optional[int] = None) -> dict:
    meta = {
        "page": page,
        "limit": limit,
        "returned": returned if returned is not None else 0,
    }
    if total is not None:
        meta["total"] = total
        meta["has_next"] = page * limit < total
    return meta


def apply_query_controls(cursor: Any, *, page: int, limit: int, sort: Optional[list[tuple[str, int]]] = None, max_time_ms: int = DEFAULT_QUERY_MAX_TIME_MS):
    if sort:
        cursor = cursor.sort(sort)
    return cursor.skip(skip_for_page(page, limit)).limit(limit).max_time_ms(max_time_ms)


def projection(*fields: str, include_id: bool = False) -> dict:
    selected = {field: 1 for field in fields if field}
    if not include_id:
        selected["_id"] = 0
    return selected


def exclude_private_projection(extra_exclusions: Optional[list[str]] = None) -> dict:
    excluded = {
        "_id": 0,
        "password_hash": 0,
        "hashed_password": 0,
        "mfa_secret": 0,
        "mfa_pending_secret": 0,
        "temporary_password": 0,
        "reset_code": 0,
    }
    for field in extra_exclusions or []:
        excluded[field] = 0
    return excluded


def as_utc(value: Any) -> Optional[datetime]:
    if not value:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str):
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    return None
