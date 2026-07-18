# Deployment Notes

## Deployment Artifacts

- API image: `backend/Dockerfile`
- Worker image: `backend/Dockerfile.worker`
- Main frontend image: `frontend/Dockerfile`
- Super-admin image: `super-admin-dashboard/Dockerfile`
- Compose template: `docker-compose.production.example.yml`
- CI workflow: `.github/workflows/ci.yml`

## Required Production Configuration

- `APP_ENV=production`
- `MONGO_URL`
- `DB_NAME`
- `SECRET_KEY`
- `ALLOWED_ORIGINS` or `ALLOWED_ORIGIN_REGEX`
- `FRONTEND_URL`

Secrets can also be supplied through `*_FILE` variables for secret-store mounts.

## Health Gates

- Use `/api/health` for liveness.
- Use `/api/ready` for traffic routing and rollout gates.

## Rollback

Use immutable image tags. Roll back API, worker, and frontend artifacts independently. Prefer forward-fix database changes unless a downgrade script has been verified in staging.
