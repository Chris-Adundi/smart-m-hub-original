# Dependency Scanning

Phase 1 introduces a repeatable dependency scanning baseline for Smart M Hub. The checks are intentionally non-invasive and do not change installed packages.

## Backend

Run from the repository root:

```powershell
python -m pip_audit
```

If `pip-audit` is not installed in the current environment:

```powershell
python -m pip install pip-audit
python -m pip_audit
```

## Frontend

Run from `frontend/`:

```powershell
npm audit --omit=dev
```

Run the same check from `super-admin-dashboard/` when that application has its own package lock:

```powershell
npm audit --omit=dev
```

## SBOM

Generate SBOMs before production releases:

```powershell
python -m cyclonedx_py environment --output-file backend-sbom.json
npx @cyclonedx/cyclonedx-npm --output-file frontend-sbom.json
```

## Policy

- Critical and high vulnerabilities in runtime dependencies block production deployment.
- Development-only vulnerabilities are reviewed for exploitability and fixed before the next release where practical.
- Dependency updates must pass backend tests, frontend builds, and authentication smoke checks.
- Generated SBOMs should be stored with release artifacts, not committed when they contain environment-specific paths.
