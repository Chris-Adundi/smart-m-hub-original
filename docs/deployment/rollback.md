# Rollback Strategy

## Requirements

- Every release must have immutable image tags.
- Database migrations must be reviewed for backward compatibility.
- Health-gated deployments must check `/api/ready`.
- Previous frontend static artifacts must remain available for rollback.

## API Rollback

1. Stop routing traffic to unhealthy instances.
2. Redeploy the previous API image tag.
3. Confirm `/api/ready` passes.
4. Check structured logs for repeated 5xx errors.
5. Re-enable traffic gradually.

## Worker Rollback

1. Stop new worker instances.
2. Deploy the previous worker image tag.
3. Confirm queue backlog starts decreasing.
4. Inspect failed jobs and retry only after root cause is understood.

## Frontend Rollback

1. Restore the previous static artifact or CDN version.
2. Purge CDN cache for `index.html`.
3. Keep immutable hashed assets cached.

## Database Rollback

Prefer forward fixes for data migrations. Use migration downgrade scripts only when the downgrade is explicitly safe and verified on staging.
