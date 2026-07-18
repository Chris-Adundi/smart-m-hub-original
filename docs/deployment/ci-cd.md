# CI/CD Pipeline

The GitHub Actions workflow in `.github/workflows/ci.yml` validates a clean checkout through:

- Backend dependency install and `pip check`.
- Backend compile checks.
- Migration compile checks.
- Backend regression tests.
- Main frontend dependency install, critical audit, and production build.
- Super-admin dependency install, critical audit, and production build.
- Docker builds for API, worker, main frontend, and super-admin frontend.

## Recommended Release Flow

```mermaid
flowchart LR
    Commit --> CI[CI Validation]
    CI --> Images[Container Images]
    Images --> Staging[Deploy Staging]
    Staging --> Ready[/api/ready]
    Ready --> Approval[Human Approval]
    Approval --> Production[Production Deploy]
    Production --> Health[Health Gate]
    Health --> Rollback[Automatic Rollback If Failed]
```

## Required Branch Protections

- Require CI success before merge.
- Require at least one review for production branches.
- Block direct pushes to production branches.
- Require signed or verified commits where possible.

## Migration Policy

Migration scripts should be committed with application changes. CI compiles migrations; production deployments should run migration dry-runs against staging before approval.
