"""
Phase 3 performance indexes for queued report work.

Usage:
    python backend/migrations/phase3_performance_indexes.py
    python backend/migrations/phase3_performance_indexes.py --rollback
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path

from dotenv import load_dotenv
from pymongo import ASCENDING, MongoClient


ROOT_DIR = Path(__file__).resolve().parents[1]
load_dotenv(ROOT_DIR / ".env")


def database():
    app_env = os.getenv("APP_ENV", os.getenv("ENV", "development")).lower()
    mongo_url = os.getenv("MONGO_URL")
    if not mongo_url:
        if app_env in {"production", "prod"}:
            raise RuntimeError("MONGO_URL must be set in production")
        mongo_url = "mongodb://localhost:27017"
    return MongoClient(mongo_url)[os.getenv("DB_NAME", "smart_m_hub")]


INDEXES = {
    "report_jobs": [
        ("report_jobs_school_status_created_idx", [("school_id", ASCENDING), ("status", ASCENDING), ("created_at", ASCENDING)], {}),
        ("report_jobs_id_idx", [("id", ASCENDING)], {"unique": True}),
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
    parser.add_argument("--rollback", action="store_true")
    args = parser.parse_args()
    db = database()
    if args.rollback:
        rollback_indexes(db)
    else:
        apply_indexes(db)


if __name__ == "__main__":
    main()
