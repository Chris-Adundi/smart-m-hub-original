from __future__ import annotations

import os


def enabled(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return str(raw).strip().lower() in {"1", "true", "yes", "on"}


ASYNC_BULK_REPORTS = enabled("FEATURE_ASYNC_BULK_REPORTS", False)
ASYNC_NOTIFICATIONS = enabled("FEATURE_ASYNC_NOTIFICATIONS", True)
OBJECT_STORAGE_ENABLED = enabled("FEATURE_OBJECT_STORAGE", False)
REDIS_CACHE_ENABLED = enabled("FEATURE_REDIS_CACHE", False)
