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
    ("event_log", [("school_id", 1), ("event_type", 1), ("created_at", -1)], {"name": "event_log_school_type_created_idx"}),
    ("event_log", [("entity_type", 1), ("entity_id", 1), ("created_at", -1)], {"name": "event_log_entity_created_idx"}),
    ("report_artifacts", [("school_id", 1), ("report_id", 1), ("artifact_type", 1)], {"name": "report_artifacts_report_type_idx"}),
    ("report_artifacts", [("qr_verification_token", 1)], {"unique": True, "name": "report_artifacts_qr_token_idx"}),
    ("webhook_endpoints", [("school_id", 1), ("event_types", 1), ("is_active", 1)], {"name": "webhook_endpoints_school_events_active_idx"}),
    ("webhook_events", [("school_id", 1), ("event_type", 1), ("status", 1), ("created_at", -1)], {"name": "webhook_events_school_type_status_created_idx"}),
    ("assessment_templates", [("school_id", 1), ("class_name", 1), ("pathway", 1), ("version", -1)], {"name": "assessment_templates_version_idx"}),
]


async def upgrade():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    for collection_name, keys, options in INDEXES:
        await db[collection_name].create_index(keys, **options)
        print(f"created {collection_name}.{options['name']}")
    client.close()


async def downgrade():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    for collection_name, _, options in reversed(INDEXES):
        try:
            await db[collection_name].drop_index(options["name"])
            print(f"dropped {collection_name}.{options['name']}")
        except Exception as exc:
            print(f"skipped {collection_name}.{options['name']}: {exc}")
    client.close()


if __name__ == "__main__":
    action = os.getenv("MIGRATION_ACTION", "upgrade").lower()
    asyncio.run(downgrade() if action == "downgrade" else upgrade())
