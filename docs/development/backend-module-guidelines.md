# Backend Module Guidelines

## Current Compatibility Rule

`backend/server.py` remains the compatibility host for existing route handlers. Domain routers under `backend/app/` now receive existing route objects mechanically before application mounting, preserving current paths while creating module boundaries for future handler movement.

Do not move a route until:

- The current path, method, request shape, and response shape are covered by tests.
- The frontend route or API caller has been checked.
- School isolation behavior has a regression test.
- The old route decorator is removed only after the new router is mounted with the same path.
- For migrated compatibility routes, keep `DOMAIN_ROUTE_COUNTS` tests passing so paths are not accidentally lost.

## Target Structure

```text
backend/app/
  core/
    responses.py
    serialization.py
    roles.py
    settings.py
  repositories/
    mongo.py
  staff/
    router.py
    constants.py
  students/
    router.py
  finance/
    router.py
  cbc/
    router.py
```

## Domain Module Pattern

Each domain should use:

- `router.py` for FastAPI route declarations.
- `schemas.py` for request/response models.
- `service.py` for business logic.
- `repository.py` for MongoDB access where query logic is reused.
- `tests` before moving existing handlers.

## Route Extraction Checklist

- Preserve the same route path.
- Preserve `/api` and `/api/v1` compatibility.
- Preserve authentication dependencies.
- Preserve school-level filters.
- Preserve pagination metadata where already returned.
- Run backend route tests and both frontend builds.

## Shared Utilities

Use:

- `app.core.responses.api_success`
- `app.core.responses.error_code_for_status`
- `app.core.serialization.serialize_doc`
- `app.core.serialization.serialize_docs`
- `app.core.serialization.ensure_id`
- `app.core.roles.STAFF_AUTH_ROLES`
- `app.core.roles.STAFF_DESIGNATIONS`
