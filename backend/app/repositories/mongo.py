from __future__ import annotations

from typing import Any, Optional


class MongoRepository:
    def __init__(self, collection: Any):
        self.collection = collection

    async def find_by_id(self, resource_id: str, *, school_id: Optional[str] = None) -> Optional[dict]:
        query = {"id": resource_id}
        if school_id is not None:
            query["school_id"] = school_id
        return await self.collection.find_one(query)

    async def soft_delete(self, resource_id: str, *, school_id: Optional[str] = None, update: Optional[dict] = None):
        query = {"id": resource_id}
        if school_id is not None:
            query["school_id"] = school_id
        payload = {"deleted": True, **(update or {})}
        return await self.collection.update_one(query, {"$set": payload})
