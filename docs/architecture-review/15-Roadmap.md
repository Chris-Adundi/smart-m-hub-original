# Priority Roadmap

## Critical Priority

### 1. Centralize Authorization And Tenant Isolation

Problem:

Authorization is repeated in many endpoints.

Recommendation:

Create shared policy functions and tenant guards. Add cross-school access tests.

Impact: Very High.

Effort: Medium.

Migration:

Start with high-risk modules: students, staff, finance, CBC reports, super admin.

### 2. Add Pagination Everywhere

Problem:

Several endpoints fetch large lists into memory.

Recommendation:

Standardize pagination and max limits for all list endpoints.

Impact: Very High.

Effort: Medium.

Migration:

Keep old response aliases temporarily where necessary.

### 3. Move Uploads To Object Storage

Problem:

Local filesystem uploads block horizontal scaling.

Recommendation:

Use object storage with signed URLs and metadata records.

Impact: Very High.

Effort: Medium.

Migration:

Backfill existing local files to object storage and preserve old URLs through a proxy or redirect.

### 4. Add Queue And Background Workers

Problem:

Bulk work is synchronous.

Recommendation:

Introduce a job queue for reports, PDFs, notifications, imports, and summaries.

Impact: Very High.

Effort: High.

Migration:

Start with CBC bulk report generation and PDF rendering.

### 5. Modularize Backend

Problem:

`server.py` has too many responsibilities.

Recommendation:

Split into domain routers, services, repositories, schemas, and policies.

Impact: Very High.

Effort: High.

Migration:

Move one domain at a time without changing public routes.

## High Priority

| Item | Impact | Effort | Notes |
|---|---:|---:|---|
| Add API versioning | High | Medium | Preserve `/api` initially |
| Standardize responses/errors | High | Medium | Improves frontend/mobile |
| Add Redis cache | High | Medium | Branding, permissions, dashboards |
| Add refresh tokens/sessions | High | Medium | Enterprise auth |
| Add structured logs/metrics | High | Medium | Production support |
| Add CI/CD pipeline | High | Medium | Safer releases |
| Add database backup runbook | High | Medium | Required for production |
| Add compound index review | High | Medium | Scale foundation |

## Medium Priority

| Item | Impact | Effort | Notes |
|---|---:|---:|---|
| Frontend server-state cache | Medium | Medium | TanStack Query or similar |
| Shared paginated table component | Medium | Medium | Consistent UX |
| Error boundaries | Medium | Low | Better resilience |
| Report template versioning | High | Medium | CBC future-proofing |
| Notification abstraction | High | Medium | SMS/email/push |
| API response DTOs | High | Medium | Security and mobile readiness |

## Low Priority

| Item | Impact | Effort | Notes |
|---|---:|---:|---|
| Remove dead scripts | Medium | Low | After migration |
| UI polish/accessibility pass | Medium | Medium | Improves adoption |
| Documentation cleanup | Medium | Low | Developer onboarding |
| Analytics warehouse plan | High future value | High | After event foundation |

## Suggested 90-Day Plan

### Days 1-30: Stabilization

- Add pagination standards.
- Add high-risk authorization tests.
- Add core policy helpers.
- Add security headers and rate limits.
- Add object storage abstraction.
- Add CI build/test pipeline.

### Days 31-60: Scale Foundation

- Move uploads to object storage.
- Add queue and worker service.
- Move CBC bulk jobs to workers.
- Add structured logs and metrics.
- Add dashboard summaries.
- Add API versioning skeleton.

### Days 61-90: Architecture Foundation

- Extract staff, students, finance, and CBC modules from `server.py`.
- Add standardized response schemas.
- Add refresh token/session model.
- Add report rendering worker.
- Add backup/restore runbook.
- Add staging deployment pipeline.

## Final Recommendation

Smart M Hub should not be rewritten. It should be hardened incrementally. The product scope is strong, but enterprise readiness depends on reducing backend concentration, enforcing tenant isolation centrally, replacing local files, introducing background jobs, and making high-volume APIs paginated and observable.
