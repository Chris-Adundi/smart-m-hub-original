from fastapi.testclient import TestClient

from observability import MetricsRegistry, resolve_trace_id
from server import app


def test_trace_id_uses_traceparent_when_present():
    trace_id = "0123456789abcdef0123456789abcdef"
    assert resolve_trace_id({"traceparent": f"00-{trace_id}-0123456789abcdef-01"}) == trace_id


def test_metrics_registry_records_request_latency():
    registry = MetricsRegistry()
    registry.record_request("GET", "/api/health", 200, 12.5)
    snapshot = registry.snapshot(queue_depth=3)

    assert snapshot["counters"]["http_requests_total"] == 1
    assert snapshot["counters"]["http_requests_2xx_total"] == 1
    assert snapshot["queue_depth"] == 3
    assert snapshot["latency"]["GET /api/health 200"]["avg_ms"] == 12.5


def test_health_response_includes_request_and_trace_ids():
    client = TestClient(app)
    response = client.get("/api/health", headers={"X-Request-ID": "req_test"})

    assert response.status_code == 200
    assert response.headers["x-request-id"] == "req_test"
    assert response.headers.get("x-trace-id")
    assert response.json()["data"]["status"] == "ok"
