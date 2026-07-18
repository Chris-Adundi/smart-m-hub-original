# API Review

## Current API State

The API exposes many useful endpoints under `/api`, but response formats and naming conventions vary. Some endpoints return raw arrays, others return `{success, data}`, and others return custom objects.

## Strengths

- FastAPI automatically provides OpenAPI.
- Domain paths are mostly understandable.
- Existing frontend API client centralizes auth headers.
- Upload, auth, student, staff, finance, attendance, exams, CBC, support, and platform APIs exist.

## Risks

- No explicit API versioning.
- Inconsistent response envelope.
- Inconsistent pagination.
- Some endpoints use query parameters for important mutation inputs.
- Error details vary.
- OpenAPI schemas are incomplete where handlers accept raw `dict`.

## Recommended API Standards

### Versioning

Adopt:

```text
/api/v1/...
```

Keep existing `/api/...` routes as compatibility aliases until clients migrate.

### Response Envelope

Use a consistent shape:

```json
{
  "success": true,
  "data": {},
  "message": "Optional message",
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 100
  },
  "request_id": "req_..."
}
```

### Error Envelope

```json
{
  "success": false,
  "error": {
    "code": "permission_denied",
    "message": "You do not have permission to perform this action",
    "details": {}
  },
  "request_id": "req_..."
}
```

## API Naming Recommendations

| Current Style | Recommended Style |
|---|---|
| `/results/{student_id}` | `/students/{student_id}/results` |
| `/finance/transactions` | Keep, add pagination |
| `/assessments/reports/bulk-generate` | `/assessment-reports:bulk-generate` or keep with documented convention |
| `/admin/users/{id}/approve` | `/admin/users/{id}/approval` with action body |

Do not break existing routes immediately. Add new routes and deprecate old ones gradually.

## OpenAPI Completeness

Recommendations:

- Replace raw `dict` request bodies with Pydantic schemas.
- Add response models for major endpoints.
- Tag routes by module.
- Add operation IDs.
- Add examples for mobile and integration partners.

## Priority Recommendations

| Recommendation | Priority | Impact | Effort |
|---|---|---:|---:|
| Add pagination standard | Critical | Very High | Medium |
| Standardize response envelopes | High | High | Medium |
| Add API versioning | High | High | Medium |
| Replace raw dict schemas | Medium | High | Medium |
| Add OpenAPI tags and examples | Medium | Medium | Low |
