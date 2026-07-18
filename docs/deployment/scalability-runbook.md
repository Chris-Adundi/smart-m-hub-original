# Scalability Runbook

## Runtime Components

- API instances: FastAPI processes behind a load balancer.
- Worker instances: `python backend/worker.py`.
- MongoDB: replica set or managed cluster with online indexes.
- Redis: configured through `REDIS_URL` for cache and shared rate-limit counters.
- Object storage: configured with `STORAGE_BACKEND=s3`, `S3_BUCKET`, and optional `S3_ENDPOINT_URL`.

## Feature Flags

| Flag | Default | Purpose |
|---|---:|---|
| `FEATURE_ASYNC_BULK_REPORTS` | `false` | Makes `/assessments/reports/bulk-generate` queue jobs by default |
| `FEATURE_ASYNC_NOTIFICATIONS` | `true` | Queues notification delivery records after in-app notification creation |
| `FEATURE_OBJECT_STORAGE` | `false` | Documents object storage rollout state |
| `FEATURE_REDIS_CACHE` | `false` | Documents Redis cache rollout state |

## Object Storage Rollout

1. Configure bucket, credentials, and endpoint in staging.
2. Set `STORAGE_BACKEND=s3`.
3. Upload test images and PDFs through `/api/uploads`.
4. Confirm `file_assets.storage_backend` is `s3` and URLs resolve.
5. Backfill old local files using a separate, school-scoped migration.
6. Keep the local `/uploads` mount until all old assets are backfilled.

## Worker Rollout

1. Run API and worker against the same MongoDB database.
2. Start one worker: `python backend/worker.py`.
3. Queue a PDF job through `/api/assessments/reports/{report_id}/pdf-jobs`.
4. Queue CBC bulk generation through `/api/assessments/reports/bulk-generate-jobs?exam_id=...`.
5. Scale workers horizontally after job indexes are applied.

## MongoDB Pool Settings

- `MONGO_MAX_POOL_SIZE`: default `100`.
- `MONGO_MIN_POOL_SIZE`: default `0`.
- `MONGO_SERVER_SELECTION_TIMEOUT_MS`: default `5000`.
- `MONGO_CONNECT_TIMEOUT_MS`: default `10000`.
- `MONGO_SOCKET_TIMEOUT_MS`: default `20000`.

## Rollback

- Switch `STORAGE_BACKEND=local` to restore current local uploads.
- Set `FEATURE_ASYNC_BULK_REPORTS=false` to keep legacy synchronous bulk generation.
- Stop workers without affecting API reads.
- Roll back Phase 4 indexes with `python backend/migrations/phase4_scalability_indexes.py --rollback`.
