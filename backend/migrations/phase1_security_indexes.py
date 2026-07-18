"""
Phase 1 security indexes for session tracking, request throttling, upload assets,
and admin-mediated staff password reset requests.

Usage:
    python backend/migrations/phase1_security_indexes.py
    python backend/migrations/phase1_security_indexes.py --rollback
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path

from dotenv import load_dotenv
from pymongo import ASCENDING, DESCENDING, MongoClient


ROOT_DIR = Path(__file__).resolve().parents[1]
load_dotenv(ROOT_DIR / ".env")


def database():
    app_env = os.getenv("APP_ENV", os.getenv("ENV", "development")).lower()
    mongo_url = os.getenv("MONGO_URL")
    if not mongo_url:
        if app_env in {"production", "prod"}:
            raise RuntimeError("MONGO_URL must be set in production")
        mongo_url = "mongodb://localhost:27017"
    db_name = os.getenv("DB_NAME", "smart_m_hub")
    return MongoClient(mongo_url)[db_name]


INDEXES = {
    "rate_limits": [
        ("rate_limits_key_idx", [("key", ASCENDING)], {"unique": True}),
        ("rate_limits_ttl_idx", [("expires_at", ASCENDING)], {"expireAfterSeconds": 0}),
    ],
    "auth_sessions": [
        ("auth_sessions_id_idx", [("id", ASCENDING)], {"unique": True}),
        ("auth_sessions_user_active_idx", [("user_id", ASCENDING), ("revoked", ASCENDING), ("expires_at", DESCENDING)], {}),
    ],
    "file_assets": [
        ("file_assets_school_category_created_idx", [("school_id", ASCENDING), ("category", ASCENDING), ("created_at", DESCENDING)], {}),
        ("file_assets_sha256_idx", [("sha256", ASCENDING)], {}),
    ],
    "staff_password_reset_requests": [
        ("staff_reset_school_status_created_idx", [("school_id", ASCENDING), ("status", ASCENDING), ("created_at", DESCENDING)], {}),
        ("staff_reset_user_status_idx", [("user_id", ASCENDING), ("status", ASCENDING)], {}),
    ],
}


def apply_indexes(db):
    for collection_name, specs in INDEXES.items():
        collection = db[collection_name]
        for name, keys, options in specs:
            collection.create_index(keys, name=name, **options)
            print(f"created {collection_name}.{name}")


def rollback_indexes(db):
    for collection_name, specs in INDEXES.items():
        collection = db[collection_name]
        existing = collection.index_information()
        for name, _, _ in specs:
            if name in existing:
                collection.drop_index(name)
                print(f"dropped {collection_name}.{name}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--rollback", action="store_true", help="Drop indexes created by this migration")
    args = parser.parse_args()
    db = database()
    if args.rollback:
        rollback_indexes(db)
    else:
        apply_indexes(db)


if __name__ == "__main__":
    main()
