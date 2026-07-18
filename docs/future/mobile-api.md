# Mobile API Standards

## Goals

Future Android and iOS apps should use the same backend without special-case APIs for core workflows.

## Standards

- Use `/api/v1` paths for mobile clients.
- Use bounded pagination on all list endpoints.
- Include `X-Request-ID` on every request.
- Cache read-heavy reference data locally.
- Treat history records as append-only.
- Use server timestamps for conflict resolution.

## Sync Manifest

`GET /api/mobile/sync-manifest` exposes the current offline-friendly resource list and pagination conventions.

## Conflict Policy

Initial policy: server wins for current records, history remains append-only. Offline write support should be added one workflow at a time with explicit conflict tests.
