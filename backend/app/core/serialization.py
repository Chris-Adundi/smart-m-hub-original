from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Iterable


def generate_uuid() -> str:
    return str(uuid.uuid4())


def serialize_doc(doc: dict) -> dict:
    if not doc:
        return doc
    cleaned = {}
    for key, value in doc.items():
        if key == "_id":
            continue
        cleaned[key] = value.isoformat() if isinstance(value, datetime) else value
    return cleaned


def serialize_docs(docs: Iterable[dict]) -> list[dict]:
    return [serialize_doc(doc) for doc in docs]


def ensure_id(doc: dict) -> dict:
    if doc and not doc.get("id"):
        doc["id"] = generate_uuid()
    return doc
