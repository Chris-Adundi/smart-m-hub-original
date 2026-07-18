from __future__ import annotations

import os
from pathlib import Path
from typing import Optional


class StorageError(RuntimeError):
    pass


def storage_backend() -> str:
    configured = os.getenv("STORAGE_BACKEND", "local").strip().lower()
    if configured in {"s3", "object", "object_storage"}:
        return "s3"
    return "local"


def store_upload(
    *,
    payload: bytes,
    content_type: str,
    upload_root: Path,
    school_key: str,
    category: str,
    filename: str,
) -> dict:
    key = f"{school_key}/{category}/{filename}"
    if storage_backend() == "s3":
        return _store_s3(payload=payload, content_type=content_type, key=key)
    return _store_local(payload=payload, upload_root=upload_root, school_key=school_key, category=category, filename=filename)


def _store_local(*, payload: bytes, upload_root: Path, school_key: str, category: str, filename: str) -> dict:
    target_dir = upload_root / school_key / category
    target_dir.mkdir(parents=True, exist_ok=True)
    target_path = target_dir / filename
    target_path.write_bytes(payload)
    return {
        "storage_backend": "local",
        "storage_key": f"{school_key}/{category}/{filename}",
        "storage_path": str(target_path),
        "url": f"/uploads/{school_key}/{category}/{filename}",
        "is_private": True,
    }


def _store_s3(*, payload: bytes, content_type: str, key: str) -> dict:
    bucket = os.getenv("S3_BUCKET")
    endpoint_url: Optional[str] = os.getenv("S3_ENDPOINT_URL")
    public_base_url = os.getenv("S3_PUBLIC_BASE_URL")
    if not bucket:
        raise StorageError("S3_BUCKET must be configured when STORAGE_BACKEND=s3")
    try:
        import boto3  # type: ignore
    except Exception as exc:
        raise StorageError("boto3 is required when STORAGE_BACKEND=s3") from exc

    client = boto3.client("s3", endpoint_url=endpoint_url)
    client.put_object(Bucket=bucket, Key=key, Body=payload, ContentType=content_type)
    url = f"{public_base_url.rstrip('/')}/{key}" if public_base_url else f"s3://{bucket}/{key}"
    return {
        "storage_backend": "s3",
        "storage_key": key,
        "storage_path": f"s3://{bucket}/{key}",
        "url": url,
        "is_private": True,
    }
