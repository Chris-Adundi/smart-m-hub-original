from __future__ import annotations

import json
import os
import time
from typing import Any, Optional


class CacheClient:
    def __init__(self):
        self._memory: dict[str, tuple[float, str]] = {}
        self._redis = None
        redis_url = os.getenv("REDIS_URL")
        if redis_url:
            try:
                import redis.asyncio as redis  # type: ignore

                self._redis = redis.from_url(redis_url, decode_responses=True)
            except Exception:
                self._redis = None

    async def get_json(self, key: str) -> Optional[Any]:
        raw = None
        if self._redis:
            raw = await self._redis.get(key)
        else:
            expires_at, value = self._memory.get(key, (0, ""))
            if expires_at and expires_at > time.time():
                raw = value
            elif key in self._memory:
                self._memory.pop(key, None)
        if not raw:
            return None
        return json.loads(raw)

    async def set_json(self, key: str, value: Any, ttl_seconds: int = 300) -> None:
        raw = json.dumps(value, default=str)
        if self._redis:
            await self._redis.set(key, raw, ex=ttl_seconds)
            return
        self._memory[key] = (time.time() + ttl_seconds, raw)

    async def delete(self, key: str) -> None:
        if self._redis:
            await self._redis.delete(key)
            return
        self._memory.pop(key, None)

    async def incr_with_ttl(self, key: str, ttl_seconds: int) -> Optional[int]:
        if self._redis:
            value = await self._redis.incr(key)
            if value == 1:
                await self._redis.expire(key, ttl_seconds)
            return int(value)
        expires_at, raw = self._memory.get(key, (0, "0"))
        now = time.time()
        value = int(raw) + 1 if expires_at > now else 1
        self._memory[key] = (now + ttl_seconds, str(value))
        return value


cache = CacheClient()
