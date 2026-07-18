# Master Implementation Checklist

This checklist consolidates every approved improvement from the architecture review into implementation phases. No boxes should be checked until the corresponding work is implemented, tested, and reviewed.

## Phase 1 - Critical Security

- [x] SEC-01 Centralize tenant isolation and authorization policy helpers.
- [x] SEC-02 Add cross-tenant and privilege-escalation tests.
- [x] SEC-03 Add rate limiting for login, forgot password, join school, school resolve, uploads, support tickets, and bulk actions.
- [x] SEC-04 Harden upload security with metadata records, magic-byte checks, private file policy, and audit access.
- [x] SEC-05 Add security headers and production CSP.
- [x] SEC-06 Redact sensitive data in logs and responses.
- [x] SEC-07 Add dependency vulnerability scanning and SBOM generation.
- [x] SEC-08 Add admin-mediated staff password reset request flow.
- [x] SEC-09 Add refresh token/session revocation design in compatibility mode.
- [x] SEC-10 Add MFA option for school admins and super admins.

## Phase 2 - Database Optimization

- [x] DB-01 Add compound indexes aligned to hot queries.
- [x] DB-02 Add production index migration scripts instead of relying only on startup index creation.
- [x] DB-03 Add pagination-ready query utilities with projections.
- [x] DB-04 Add archival policy for attendance, notifications, audit logs, support logs, and generated report artifacts.
- [x] DB-05 Create dashboard and module summary collections.
- [x] DB-06 Add backup and restore runbook with point-in-time recovery targets.
- [x] DB-07 Add TTL indexes only for temporary data.
- [x] DB-08 Add data dictionary for high-value collections.

## Phase 3 - Performance Optimization

- [x] PERF-01 Add pagination to all high-volume list endpoints.
- [x] PERF-02 Add response projections and explicit DTOs for large payloads.
- [x] PERF-03 Replace N+1 loops with batch fetches and bulk writes.
- [x] PERF-04 Add dashboard summary read models.
- [x] PERF-05 Add server-side query timeouts and max result limits.
- [x] PERF-06 Move expensive report/PDF work out of request-response path.
- [x] PERF-07 Add frontend route-level code splitting.
- [x] PERF-08 Add table virtualization for large admin tables.

## Phase 4 - Scalability Improvements

- [x] SCALE-01 Move file storage from local filesystem to S3-compatible object storage.
- [x] SCALE-02 Add Redis for cache, rate limits, session metadata, and lightweight locks.
- [x] SCALE-03 Add queue and worker service.
- [x] SCALE-04 Move CBC bulk generation to worker jobs.
- [x] SCALE-05 Move notification delivery to workers.
- [x] SCALE-06 Add cache for school branding, permission maps, CBC templates, dashboard counters, and school-code resolution.
- [x] SCALE-07 Add connection pool and query timeout configuration.
- [x] SCALE-08 Add feature flags for high-risk scale features.

## Phase 5 - API Improvements

- [x] API-01 Introduce `/api/v1` routes as aliases for existing endpoints.
- [x] API-02 Standardize response envelopes.
- [x] API-03 Standardize error envelopes and error codes.
- [x] API-04 Replace raw `dict` request bodies with Pydantic schemas.
- [x] API-05 Add OpenAPI tags, operation IDs, and examples.
- [x] API-06 Add backward-compatible deprecation policy.
- [x] API-07 Move mutation parameters from query string into request bodies where appropriate.

## Phase 6 - Frontend Improvements

- [x] FE-01 Centralize role normalization and route permissions.
- [x] FE-02 Add server-state cache such as TanStack Query.
- [x] FE-03 Add shared paginated table component.
- [x] FE-04 Add route-level error boundaries.
- [x] FE-05 Add route-level code splitting.
- [x] FE-06 Split large pages into feature components.
- [x] FE-07 Standardize loading, empty, error, confirm, and form validation patterns.
- [x] FE-08 Improve accessibility for dialogs, buttons, table rows, focus management, and contrast.
- [x] FE-09 Move official report/PDF actions to backend job flow once available.

## Phase 7 - Monitoring And Logging

- [x] OBS-01 Add request IDs and structured JSON request logs.
- [x] OBS-02 Add structured audit taxonomy for privileged actions.
- [x] OBS-03 Add metrics for request count, latency, errors, logins, uploads, queue depth, workers, PDFs, and notifications.
- [x] OBS-04 Add health and readiness endpoints.
- [x] OBS-05 Add OpenTelemetry tracing.
- [x] OBS-06 Add alert rules for error spikes, login failures, DB pressure, queue backlog, upload failures, and payment callback failures.
- [x] OBS-07 Add frontend error capture.

## Phase 8 - Deployment And DevOps

- [x] DEVOPS-01 Containerize API and worker services.
- [x] DEVOPS-02 Host frontends as static CDN artifacts.
- [x] DEVOPS-03 Add CI/CD pipeline with backend compile, tests, frontend builds, lint, dependency scan, Docker build, and migration dry-run.
- [x] DEVOPS-04 Add staging environment mirroring production dependencies.
- [x] DEVOPS-05 Add secrets manager integration.
- [x] DEVOPS-06 Add rollback strategy with health-gated deployments.
- [x] DEVOPS-07 Add automated backup, PITR, object-storage versioning, and restore drills.
- [x] DEVOPS-08 Add environment-specific configuration validation.

## Phase 9 - Code Cleanup And Refactoring

- [x] REFACTOR-01 Split `backend/server.py` into domain routers and services.
- [x] REFACTOR-02 Introduce repositories for MongoDB access.
- [x] REFACTOR-03 Add typed settings object.
- [x] REFACTOR-04 Create shared serialization, pagination, error, and response utilities.
- [x] REFACTOR-05 Create module template/guidelines for future domains.
- [x] REFACTOR-06 Remove obsolete scripts and dead code after migration.
- [x] REFACTOR-07 Add documentation cleanup and developer onboarding docs.
- [x] REFACTOR-08 Separate system roles from staff designations in docs and validation.

## Phase 10 - Future Features

- [x] FUT-01 Add notification abstraction for in-app, SMS, email, and push.
- [x] FUT-02 Add webhook framework for third-party integrations.
- [x] FUT-03 Add server-side official PDF/report rendering.
- [x] FUT-04 Add report artifact storage, QR verification, checksums, and digital signature metadata.
- [x] FUT-05 Add CBC template versioning and immutable published snapshots.
- [x] FUT-06 Model senior school pathways, tracks, optional subjects, and learner selections.
- [x] FUT-07 Add mobile API standards and offline-friendly sync design.
- [x] FUT-08 Add event logging foundation and learner timeline.
- [x] FUT-09 Add analytics warehouse and data dictionary plan.
- [x] FUT-10 Define module blueprint for transport, hostel, library, clinic, payroll, HR, procurement, LMS, and marketplace.
