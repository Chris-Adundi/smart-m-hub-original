# Updated API Documentation

## API Compatibility

- Existing `/api` routes remain supported.
- `/api/v1` aliases are available through middleware and OpenAPI documentation.
- Standard error responses include `success`, `error`, `detail`, `message`, `request_id`, and `trace_id` where available.

## Added Operational Endpoints

- `GET /api/health`
- `GET /api/ready`
- `GET /api/metrics`
- `GET /api/metrics/prometheus`
- `POST /api/frontend-errors`

## Added Workflow And Future Endpoints

- `POST /api/assessments/reports/bulk-generate-jobs/request`
- `GET /api/assessments/reports/{report_id}/pdf-official`
- `GET /api/mobile/sync-manifest`
- `GET /api/webhooks/endpoints`
- `POST /api/webhooks/endpoints`

## Security Notes

- Staff account creation is controlled by School Admin/Super Admin workflows.
- Staff auth roles are separate from staff designations.
- Webhook target URLs must use HTTPS.
- Webhook signing secrets are stored as hashes and returned only once.

## Mobile Readiness

Mobile clients should use `/api/v1`, bounded pagination, `X-Request-ID`, and the `/api/mobile/sync-manifest` endpoint.
