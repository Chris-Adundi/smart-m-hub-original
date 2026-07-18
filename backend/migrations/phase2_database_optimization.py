"""
Phase 2 database optimization indexes.

This migration is additive and safe for online rollout on MongoDB deployments that
support background index builds. Rollback drops only indexes declared here.

Usage:
    python backend/migrations/phase2_database_optimization.py
    python backend/migrations/phase2_database_optimization.py --rollback
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
    return MongoClient(mongo_url)[os.getenv("DB_NAME", "smart_m_hub")]


INDEXES = {
    "users": [
        ("users_school_role_status_idx", [("school_id", ASCENDING), ("role", ASCENDING), ("status", ASCENDING)], {}),
        ("users_school_approval_role_idx", [("school_id", ASCENDING), ("approval_status", ASCENDING), ("role", ASCENDING)], {}),
    ],
    "students": [
        ("students_school_class_status_approval_idx", [("school_id", ASCENDING), ("class_name", ASCENDING), ("status", ASCENDING), ("approval_status", ASCENDING)], {}),
        ("students_school_guardian_email_idx", [("school_id", ASCENDING), ("guardian_email", ASCENDING)], {"sparse": True}),
    ],
    "payments": [
        ("payments_school_student_created_idx", [("school_id", ASCENDING), ("student_id", ASCENDING), ("created_at", DESCENDING)], {}),
        ("payments_school_approval_status_created_idx", [("school_id", ASCENDING), ("approval_status", ASCENDING), ("status", ASCENDING), ("created_at", DESCENDING)], {}),
    ],
    "finance_transactions": [
        ("finance_transactions_school_approval_date_idx", [("school_id", ASCENDING), ("approval_status", ASCENDING), ("date", DESCENDING)], {}),
    ],
    "attendance": [
        ("attendance_school_date_class_idx", [("school_id", ASCENDING), ("date", DESCENDING), ("class_name", ASCENDING)], {}),
        ("attendance_school_student_date_idx", [("school_id", ASCENDING), ("student_id", ASCENDING), ("date", DESCENDING)], {}),
        ("attendance_school_approval_archive_date_idx", [("school_id", ASCENDING), ("approval_status", ASCENDING), ("archived", ASCENDING), ("date", DESCENDING)], {}),
    ],
    "results": [
        ("results_school_exam_student_idx", [("school_id", ASCENDING), ("exam_id", ASCENDING), ("student_id", ASCENDING)], {}),
    ],
    "assessment_reports": [
        ("assessment_reports_student_status_created_idx", [("school_id", ASCENDING), ("student_id", ASCENDING), ("status", ASCENDING), ("created_at", DESCENDING)], {}),
        ("assessment_reports_exam_class_status_idx", [("school_id", ASCENDING), ("exam_id", ASCENDING), ("class_name", ASCENDING), ("status", ASCENDING)], {}),
    ],
    "notifications": [
        ("notifications_recipient_read_created_idx", [("school_id", ASCENDING), ("recipient_id", ASCENDING), ("read", ASCENDING), ("created_at", DESCENDING)], {}),
    ],
    "login_attempts": [
        ("login_attempts_ttl_idx", [("expires_at", ASCENDING)], {"expireAfterSeconds": 0}),
    ],
    "password_reset_codes": [
        ("password_reset_codes_ttl_idx", [("expires_at", ASCENDING)], {"expireAfterSeconds": 0}),
        ("password_reset_codes_user_used_expires_idx", [("user_id", ASCENDING), ("used", ASCENDING), ("expires_at", DESCENDING)], {}),
    ],
    "dashboard_summaries": [
        ("dashboard_summaries_school_idx", [("school_id", ASCENDING)], {"unique": True}),
        ("dashboard_summaries_updated_idx", [("updated_at", DESCENDING)], {}),
    ],
    "archive_manifests": [
        ("archive_manifests_school_collection_year_idx", [("school_id", ASCENDING), ("collection", ASCENDING), ("archive_year", ASCENDING)], {}),
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
