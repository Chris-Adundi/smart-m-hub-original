# API Versioning And Error Policy

## Route Versions

- Existing `/api/...` routes remain supported for backward compatibility.
- New clients should use `/api/v1/...`.
- `/api/v1` routes are compatibility aliases to the same handlers during this stage.
- Legacy `/api` responses include a `Deprecation: true` response header and a successor `Link` header.

## Request IDs

Every response includes:

```http
X-Request-ID: req_...
```

Clients may send `X-Request-ID`; otherwise the API generates one.

## Standard Error Envelope

Errors use this shape:

```json
{
  "success": false,
  "error": {
    "code": "validation_error",
    "message": "Request validation failed",
    "details": []
  },
  "detail": [],
  "message": "Request validation failed",
  "request_id": "req_..."
}
```

The legacy `detail` field is intentionally preserved so existing frontend code continues to work.

## Mutation Body Policy

- New mutation endpoints should use Pydantic request models.
- Existing query-parameter mutations remain supported until clients migrate.
- Prefer request-body alternatives such as `/api/v1/assessments/reports/bulk-generate-jobs/request`.

## OpenAPI

OpenAPI includes both `/api` and `/api/v1` paths. Operations are tagged by the first domain segment, with `v1` added to versioned aliases.
