from fastapi.testclient import TestClient

from server import app


def test_openapi_contains_v1_aliases():
    schema = app.openapi()
    assert "/api/auth/login" in schema["paths"]
    assert "/api/v1/auth/login" in schema["paths"]
    tags = schema["paths"]["/api/v1/auth/login"]["post"]["tags"]
    assert "auth" in tags
    assert "v1" in tags


def test_validation_errors_use_standard_envelope():
    client = TestClient(app)
    response = client.post("/api/v1/auth/refresh", json={})
    body = response.json()
    assert response.status_code == 422
    assert response.headers.get("x-request-id")
    assert body["success"] is False
    assert body["error"]["code"] == "validation_error"
    assert body["detail"]
