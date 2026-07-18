# Future Module Blueprint

Use this blueprint for transport, hostel, library, clinic, payroll, HR, procurement, LMS, online examinations, alumni, and marketplace modules.

## Backend Structure

```text
backend/app/<module>/
  router.py
  schemas.py
  service.py
  repository.py
```

## Minimum Requirements

- School isolation on every query.
- Role checks at the route boundary.
- Audit/event logging for privileged actions.
- Pagination for lists.
- Background jobs for slow external work.
- Tests for authorization and tenant isolation.

## Frontend Structure

```text
frontend/src/features/<module>/
  components/
  hooks/
  pages/
```

## Launch Checklist

- API documented in OpenAPI.
- Migration/index script included.
- Dashboard entry guarded by role.
- Empty, loading, and error states implemented.
- Production runbook updated.
