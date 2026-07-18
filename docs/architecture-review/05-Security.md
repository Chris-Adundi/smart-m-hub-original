# Security Review

## Current Security Strengths

- Passwords use hashing through existing auth helpers.
- JWTs include issuer and token type validation.
- Login lockout mechanism exists.
- Role normalization exists.
- School status and subscription checks exist during authenticated access.
- Uploads validate category, MIME type, extension, and size.
- Security/audit events are written for several sensitive actions.

## Critical Findings

### Local File Upload Storage

Files are stored under backend local storage and served directly. This is not suitable for horizontal scaling and increases risk around file execution, retention, and malware.

Recommendation:

- Use S3-compatible object storage.
- Store metadata in MongoDB.
- Serve files through signed URLs or authenticated proxy.
- Add malware scanning.
- Generate image thumbnails and safe previews.

Priority: Critical.

Impact: Very High.

Effort: Medium.

### Distributed Authorization Risk

Many endpoints implement role checks manually. This creates inconsistency risk.

Recommendation:

- Implement centralized policy functions.
- Require explicit tenant scope for every domain operation.
- Add tests for cross-school access attempts.

Priority: Critical.

Impact: Very High.

Effort: Medium.

### Rate Limiting

Auth and public endpoints need stronger rate limits.

Endpoints needing protection:

- Login
- Forgot password
- Join school
- School resolve
- Uploads
- Support ticket creation
- Bulk actions

Priority: High.

Impact: High.

Effort: Medium.

## Sensitive Data Exposure

Recommendations:

- Never return password hashes, temporary passwords, reset codes, or internal tokens.
- Use response DTOs with explicit fields.
- Mask phone numbers and emails where appropriate in super admin views.
- Redact PII in logs.

## Web Security Headers

Add:

- Content Security Policy
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options` or CSP frame ancestors
- `Referrer-Policy`
- `Permissions-Policy`
- HSTS in production

## Dependency Security

Recommendations:

- Add `pip-audit` or equivalent.
- Add `npm audit` or Snyk/GitHub Dependabot.
- Pin and review critical security dependencies.
- Generate SBOM during CI.

## File Upload Security

Required controls:

- Size limit by tenant and category.
- Extension and content-type validation.
- Magic-byte validation.
- Virus scanning.
- Private buckets by default.
- Signed URLs with expiry.
- Audit file access for sensitive documents.

## Priority Recommendations

| Recommendation | Priority | Impact | Effort |
|---|---|---:|---:|
| Central policy enforcement | Critical | Very High | Medium |
| Object storage and signed URLs | Critical | Very High | Medium |
| Rate limiting | High | High | Medium |
| Security headers | High | Medium | Low |
| Dependency scanning | High | High | Low |
| PII redaction | Medium | High | Medium |
