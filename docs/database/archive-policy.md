# Archive Policy

Smart M Hub preserves historical academic and financial records permanently. Archiving moves old high-volume operational records out of hot query paths without deleting source history.

## Live Collections

| Collection | Hot Window | Archive Strategy |
|---|---:|---|
| `attendance` | Current academic year or 4 months of detail | Mark `archived: true`, retain `attendance_summaries` permanently |
| `notifications` | 12 months | Move closed/read records to cold storage after export |
| `audit_logs` | 24 months | Keep privileged/security actions online longer; export older logs |
| `support_tickets` | 24 months after closure | Export resolved tickets and attachments |
| `file_assets` | Active records online | Move binary content to object lifecycle tiers in Phase 4 |
| `assessment_reports` | Permanent online metadata | Store generated PDF artifacts in object storage; never delete report records |

## Manifest Collection

Archive jobs should write `archive_manifests` documents:

```json
{
  "id": "uuid",
  "school_id": "school uuid",
  "collection": "attendance",
  "archive_year": 2026,
  "status": "completed",
  "document_count": 120000,
  "checksum": "sha256",
  "storage_uri": "s3://bucket/path/file.jsonl.gz",
  "created_at": "2026-07-18T00:00:00Z"
}
```

## Rules

- Never delete learner, finance, examination, CBC report, or report history records.
- Archive operations must be school-scoped unless run by Super Admin maintenance tooling.
- Archive exports must be verified before records are marked archived.
- Temporary collections may use TTL indexes when the data is not source-of-truth.
