# Smart M Hub Alert Rules

## Critical Alerts

| Alert | Suggested Rule | Action |
|---|---|---|
| API unavailable | `/api/health` fails for 2 minutes | Restart instance and inspect deployment logs. |
| API not ready | `/api/ready` fails for 1 minute | Remove instance from traffic and inspect MongoDB connectivity. |
| High 5xx rate | `smart_m_hub_http_requests_5xx_total` increases rapidly over 5 minutes | Inspect recent request logs by `trace_id`. |
| Queue backlog | `smart_m_hub_queue_depth` exceeds operational threshold for 10 minutes | Scale workers or inspect stuck jobs. |
| Login failure spike | Audit logs with authentication warnings spike in 10 minutes | Check for credential stuffing or school-code abuse. |

## High Priority Alerts

| Alert | Suggested Rule | Action |
|---|---|---|
| Elevated latency | Average request latency exceeds SLO for 10 minutes | Review slow endpoints and MongoDB query metrics. |
| Frontend error spike | `smart_m_hub_frontend_errors_total` increases above baseline | Inspect `/api/frontend-errors` records by portal and route. |
| Upload failure spike | 4xx/5xx responses on upload routes exceed baseline | Check file size, content type, storage credentials, and disk or bucket availability. |
| PDF job failures | Report/PDF jobs fail repeatedly | Inspect worker logs and PDF generation dependencies. |
| Payment callback failures | M-Pesa callback route returns 4xx/5xx | Validate callback payloads, secrets, and database writes. |

## Operational Runbook

1. Start with the alerting metric and affected time window.
2. Search structured logs by `request_id` or `trace_id`.
3. Check `/api/ready` to separate application errors from dependency failures.
4. Review queued jobs if reports, notifications, or PDFs are delayed.
5. For tenant-specific incidents, filter logs and audit records by `school_id`.

## Dashboard Panels

Recommended Grafana panels:

- API request rate by status family.
- P95 and average latency by route.
- Error rate by route.
- MongoDB readiness failures.
- Queue depth by job type where available.
- Frontend errors by portal and route.
- Audit warnings by category and school.
