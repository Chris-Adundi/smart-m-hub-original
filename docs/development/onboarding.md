# Developer Onboarding

## Backend

1. Create and activate a Python virtual environment.
2. Install dependencies from `backend/requirements.txt`.
3. Copy `backend/.env.example` to `backend/.env` and adjust local values.
4. Run compile checks:

```bash
python -m py_compile backend/server.py backend/auth.py backend/worker.py
```

5. Run focused tests:

```bash
python -m pytest backend/test_phase1_security_controls.py backend/test_phase5_api.py backend/test_phase9_refactor.py
```

## Frontend

Main portal:

```bash
cd frontend
npm ci
npm run build
```

Super-admin portal:

```bash
cd super-admin-dashboard
npm ci
npm run build
```

## Architecture Notes

- Existing API behavior is preserved in `backend/server.py`.
- New shared backend utilities live in `backend/app/core`.
- New domain modules should be extracted incrementally with tests.
- Staff auth roles and staff designations are separate concepts.

## Local Warnings

The current FastAPI startup/shutdown handlers use `on_event`, which emits deprecation warnings. This is documented technical debt and should be migrated to lifespan handlers after route extraction has stronger coverage.
