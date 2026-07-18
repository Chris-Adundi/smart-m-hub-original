# Containerization

## Images

Smart M Hub now has separate deployable images for each runtime:

| Runtime | Dockerfile | Purpose |
|---|---|---|
| API | `backend/Dockerfile` | FastAPI service exposed on port 8000. |
| Worker | `backend/Dockerfile.worker` | Background jobs for reports, PDFs, and notifications. |
| Main frontend | `frontend/Dockerfile` | Static React app served by Nginx. |
| Super-admin frontend | `super-admin-dashboard/Dockerfile` | Static Vite app served by Nginx. |

## Local Production-Style Build

```bash
docker build -f backend/Dockerfile -t smart-m-hub-api:local .
docker build -f backend/Dockerfile.worker -t smart-m-hub-worker:local .
docker build -f frontend/Dockerfile --build-arg REACT_APP_BACKEND_URL=https://api.example.com -t smart-m-hub-frontend:local .
docker build -f super-admin-dashboard/Dockerfile --build-arg VITE_API_BASE_URL=https://api.example.com/api/platform -t smart-m-hub-super-admin:local .
```

## Compose Template

Use `docker-compose.production.example.yml` as a deployment template. It expects:

- `backend/.env.production` for API and worker runtime settings.
- `PUBLIC_API_URL` for the main frontend build.
- `PUBLIC_PLATFORM_API_URL` for the super-admin frontend build.
- `SMART_M_HUB_VERSION` to tag images consistently.

## Health Gates

- API liveness: `/api/health`
- API readiness: `/api/ready`

Load balancers should use readiness for traffic routing. Process managers should use liveness for restarts.
