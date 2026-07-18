# Smart M Hub Implementation Plan

This folder converts the architecture review into a phased implementation plan.

No application code changes are included in this plan. The phases are ordered to preserve current functionality, keep existing routes backward compatible, and reduce operational risk.

## Phase Files

- [Phase 1 - Critical Security](./01-Phase-1-Critical-Security.md)
- [Phase 2 - Database Optimization](./02-Phase-2-Database-Optimization.md)
- [Phase 3 - Performance Optimization](./03-Phase-3-Performance-Optimization.md)
- [Phase 4 - Scalability Improvements](./04-Phase-4-Scalability-Improvements.md)
- [Phase 5 - API Improvements](./05-Phase-5-API-Improvements.md)
- [Phase 6 - Frontend Improvements](./06-Phase-6-Frontend-Improvements.md)
- [Phase 7 - Monitoring and Logging](./07-Phase-7-Monitoring-Logging.md)
- [Phase 8 - Deployment and DevOps](./08-Phase-8-Deployment-DevOps.md)
- [Phase 9 - Code Cleanup and Refactoring](./09-Phase-9-Code-Cleanup-Refactoring.md)
- [Phase 10 - Future Features](./10-Phase-10-Future-Features.md)
- [Master Checklist](./MASTER-CHECKLIST.md)

## Consolidation Notes

The architecture review repeated several recommendations across multiple documents. These have been consolidated as follows:

- Pagination, projections, max page size, and large-read controls are handled once in Phase 2 and Phase 3.
- Central authorization, tenant isolation, and permission tests are handled once in Phase 1.
- Object storage appears in security, scalability, reporting, and deployment; the security baseline is Phase 1, full scale migration is Phase 4.
- Queues and workers appear in scalability, performance, reporting, notifications, and future AI readiness; queue foundation is Phase 4, report-specific usage is Phase 10.
- Response envelopes, DTOs, OpenAPI, and versioning are consolidated in Phase 5.
- Structured logs, metrics, tracing, health checks, and alerts are consolidated in Phase 7.
- Backend modularization, repositories, service layers, typed settings, and dead-code cleanup are consolidated in Phase 9.

## Conflict Resolution

No direct conflicts were found. The following sequencing constraints resolve practical conflicts:

- Keep existing `/api/...` routes while introducing `/api/v1/...` aliases to preserve compatibility.
- Keep current JWT login behavior while adding refresh/session support behind compatibility mode.
- Keep browser PDF generation temporarily while introducing server-rendered official PDFs later.
- Keep local upload URL compatibility while migrating storage to object storage.
- Keep current role names; treat detailed staff designations as profile metadata, not new auth roles.
- Keep startup index creation during development; move production index changes into migration scripts later.

## Implementation Rule

Each phase should be implemented with tests and backward-compatible fallbacks before moving to the next phase. Critical security work may be started earlier, but broad refactoring should wait until pagination, indexes, policy guards, and observability are in place.
