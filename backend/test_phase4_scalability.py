import asyncio
import shutil
import uuid
from pathlib import Path

from services.cache import CacheClient
from services.storage import store_upload


def test_local_storage_backend_preserves_upload_contract(monkeypatch):
    monkeypatch.setenv("STORAGE_BACKEND", "local")
    tmp_path = Path(__file__).parent / f".test-storage-{uuid.uuid4().hex}"
    stored = store_upload(
        payload=b"%PDF-test",
        content_type="application/pdf",
        upload_root=tmp_path,
        school_key="school-1",
        category="document",
        filename="report.pdf",
    )
    assert stored["storage_backend"] == "local"
    assert stored["url"] == "/uploads/school-1/document/report.pdf"
    assert (tmp_path / "school-1" / "document" / "report.pdf").exists()
    shutil.rmtree(tmp_path)


def test_cache_incr_with_ttl_uses_memory_fallback(monkeypatch):
    monkeypatch.delenv("REDIS_URL", raising=False)
    cache = CacheClient()

    async def run():
        assert await cache.incr_with_ttl("rate:test", 60) == 1
        assert await cache.incr_with_ttl("rate:test", 60) == 2

    asyncio.run(run())
