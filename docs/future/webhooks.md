# Webhook Framework

## Purpose

Webhooks allow future third-party integrations to receive signed Smart M Hub events without direct database access.

## Endpoint Rules

- Webhook target URLs must use HTTPS.
- Signing secrets are shown once at creation.
- Stored secrets are hashed.
- Delivery should run through queued `webhook_delivery` jobs.

## Signature

Payloads are canonical JSON and signed with HMAC-SHA256.

```text
X-Smart-M-Hub-Signature: sha256=<signature>
```

## Initial Events

Recommended initial event types:

- `assessment_report_published`
- `assessment_report_pdf_queued`
- `webhook_endpoint_created`
- `student_admitted`
- `payment_approved`
- `attendance_marked`
