from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime, timezone
from typing import Any, Optional


def now_utc():
    return datetime.now(timezone.utc)


def payload_checksum(payload: dict) -> str:
    encoded = json.dumps(payload or {}, sort_keys=True, default=str, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


async def create_report_artifact_manifest(
    db: Any,
    *,
    report: dict,
    job_id: str,
    requested_by: Optional[str],
) -> dict:
    manifest = {
        "id": str(uuid.uuid4()),
        "school_id": report.get("school_id"),
        "report_id": report.get("id"),
        "student_id": report.get("student_id"),
        "exam_id": report.get("exam_id"),
        "job_id": job_id,
        "artifact_type": "cbc_report_pdf",
        "status": "pending",
        "checksum": payload_checksum(report),
        "qr_verification_token": str(uuid.uuid4()),
        "digital_signature": {
            "status": "pending",
            "signed_by": None,
            "signed_at": None,
        },
        "immutable": True,
        "requested_by": requested_by,
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }
    await db.report_artifacts.insert_one(manifest)
    return manifest
