# Updated Database Documentation

## Added Collections And Uses

| Collection | Purpose |
|---|---|
| `auth_sessions` | Refresh-token/session tracking and revocation. |
| `login_attempts` | Login lockout and rate limiting. |
| `file_assets` | Uploaded file metadata. |
| `dashboard_summaries` | Cached dashboard counts. |
| `archive_manifests` | Archive tracking. |
| `jobs` | Background work queue. |
| `notification_deliveries` | Per-channel notification delivery state. |
| `frontend_error_events` | Browser route error capture. |
| `event_log` | Product event foundation for timelines and analytics. |
| `report_artifacts` | Immutable official report artifact metadata. |
| `webhook_endpoints` | Third-party webhook configuration. |
| `webhook_events` | Queued webhook event state. |

## Migration Scripts

- `backend/migrations/phase1_security_indexes.py`
- `backend/migrations/phase2_database_optimization.py`
- `backend/migrations/phase3_performance_indexes.py`
- `backend/migrations/phase4_scalability_indexes.py`
- `backend/migrations/phase7_observability_indexes.py`
- `backend/migrations/phase10_future_foundations.py`

## Data Safety

- Historical reports are not deleted or overwritten.
- CBC reports now store `template_version` and `template_snapshot`.
- Report artifacts are append-only by design.
- Index migrations are additive and preserve existing records.

## Production Notes

Run migrations in staging first. For production, apply during low-traffic windows and monitor `/api/ready`, MongoDB metrics, and API error rates.
