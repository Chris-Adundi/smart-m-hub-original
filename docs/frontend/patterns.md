# Frontend Patterns

## Role Policy

Use `frontend/src/utils/roleRoutes.js` for role normalization, default route selection, and route access checks. New pages should not define their own role maps.

## Server State

Use `frontend/src/hooks/useServerState.js` for cached GET requests when adding or refactoring pages. It provides a lightweight cache with explicit invalidation until a full query library is introduced.

## Tables

Use `frontend/src/components/data/PaginatedTable.jsx` for new list views that consume backend pagination. Existing pages can adopt it incrementally.

## UI States

Use `LoadingState`, `EmptyState`, and `ErrorState` from `frontend/src/components/ui/state.jsx` for consistent page and table states.

## Route Errors

Both frontends are wrapped in route-level error boundaries. Page-specific errors should still be handled locally when a retry action can preserve user input.

## Report PDFs

CBC report PDF actions should prefer backend PDF job APIs and keep browser-generated PDFs only as a fallback.
