from __future__ import annotations

import asyncio
import os
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient


ROOT_DIR = Path(__file__).resolve().parents[1]
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "smart_m_hub")


INDEXES = [
    ("audit_logs", [("school_id", 1), ("category", 1), ("severity", 1), ("timestamp", -1)], "audit_logs_taxonomy_idx"),
    ("audit_logs", [("action", 1), ("timestamp", -1)], "audit_logs_action_timestamp_idx"),
    ("frontend_error_events", [("portal", 1), ("route", 1), ("created_at", -1)], "frontend_error_events_portal_route_created_idx"),
    ("frontend_error_events", [("created_at", -1)], "frontend_error_events_created_idx"),
]


async def upgrade():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    for collection_name, keys, name in INDEXES:
        await db[collection_name].create_index(keys, name=name)
        print(f"created {collection_name}.{name}")
    client.close()


async def downgrade():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    for collection_name, _, name in reversed(INDEXES):
        try:
            await db[collection_name].drop_index(name)
            print(f"dropped {collection_name}.{name}")
        except Exception as exc:
            print(f"skipped {collection_name}.{name}: {exc}")
    client.close()


if __name__ == "__main__":
    action = os.getenv("MIGRATION_ACTION", "upgrade").lower()
    asyncio.run(downgrade() if action == "downgrade" else upgrade())
