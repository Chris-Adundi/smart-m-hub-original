from __future__ import annotations

from dataclasses import dataclass
import os


@dataclass(frozen=True)
class Settings:
    app_env: str
    db_name: str
    mongo_url: str
    service_name: str
    service_version: str
    max_upload_mb: int
    storage_backend: str


def get_settings() -> Settings:
    app_env = os.getenv("APP_ENV", os.getenv("ENV", "development")).lower()
    mongo_url = os.getenv("MONGO_URL")
    if not mongo_url and app_env not in {"production", "prod"}:
        mongo_url = "mongodb://localhost:27017"
    return Settings(
        app_env=app_env,
        db_name=os.getenv("DB_NAME", "smart_m_hub"),
        mongo_url=mongo_url or "",
        service_name=os.getenv("SERVICE_NAME", "smart-m-hub-api"),
        service_version=os.getenv("SERVICE_VERSION", "1.0.0"),
        max_upload_mb=int(os.getenv("MAX_UPLOAD_MB", "5")),
        storage_backend=os.getenv("STORAGE_BACKEND", "local").lower(),
    )
