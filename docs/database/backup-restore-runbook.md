# Backup And Restore Runbook

## Recovery Targets

- Production RPO: 15 minutes or better when hosted on a managed MongoDB service with point-in-time recovery.
- Production RTO: 2 hours for critical school operations.
- Staging RPO: 24 hours.
- Local development: no formal recovery target.

## Backup Policy

- Enable MongoDB point-in-time recovery for production.
- Keep daily snapshots for 35 days.
- Keep monthly snapshots for 12 months.
- Store object-storage backups with versioning enabled once Phase 4 object storage is deployed.
- Store release SBOMs and migration logs with release artifacts.

## Restore Procedure

1. Identify target timestamp, affected schools, and collections.
2. Restore to an isolated recovery database first.
3. Run integrity checks for schools, users, students, finance, exams, assessment reports, and attendance.
4. Export scoped records when only one school or module is affected.
5. Apply repaired data through a reviewed migration script.
6. Verify login, school isolation, dashboards, finance balances, and CBC report history.
7. Record the restore in `archive_manifests` or the incident register.

## Verification

- Perform quarterly restore drills.
- Compare document counts and key indexes after restore.
- Validate that no temporary collections such as `rate_limits`, `login_attempts`, or expired `password_reset_codes` are treated as permanent source-of-truth data.

## Rollback

- Index migrations are reversible through their `--rollback` option.
- Data migrations must include a scoped backup/export file before mutating existing documents.
- Historical learner, finance, examination, and CBC records must never be deleted as rollback strategy.
