# Backup And Recovery

## MongoDB

Production MongoDB should use:

- Automated backups.
- Point-in-time recovery.
- Cross-region backup copies where supported.
- Monthly restore drills.
- Restore verification against staging.

## Object Storage

For photos, PDFs, receipts, and documents:

- Enable bucket versioning.
- Enable server-side encryption.
- Use lifecycle policies for temporary generated files.
- Keep permanent academic reports and finance documents according to retention policy.

## Restore Drill

1. Restore the latest backup into staging.
2. Run database integrity checks.
3. Verify authentication with non-production accounts.
4. Verify school isolation queries.
5. Generate or load a CBC report.
6. Record restore duration and any manual steps.

## Recovery Targets

Recommended initial targets:

- RPO: 15 minutes or better for MongoDB.
- RTO: 4 hours or better for full platform restoration.
