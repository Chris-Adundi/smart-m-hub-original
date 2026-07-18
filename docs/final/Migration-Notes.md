# Migration Notes

## Order

Apply migrations in phase order:

1. Phase 1 security indexes.
2. Phase 2 database optimization.
3. Phase 3 performance indexes.
4. Phase 4 scalability indexes.
5. Phase 7 observability indexes.
6. Phase 10 future foundation indexes.

## Safety

All migrations added in this roadmap are additive indexes or metadata foundations. They do not delete historical data.

## Rollback

Where practical, migration scripts include downgrade behavior to drop indexes. Do not downgrade production data changes without staging verification.

## Verification

After migrations:

- Confirm `/api/ready` passes.
- Confirm login and dashboard loading.
- Confirm school-scoped list endpoints still paginate.
- Confirm CBC report loading and PDF queueing.
- Confirm MongoDB index build health.
