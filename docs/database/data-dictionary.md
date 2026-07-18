# Data Dictionary

This dictionary covers high-value Smart M Hub collections used by the Phase 2 optimization work.

| Collection | Purpose | Tenant Key | Permanent |
|---|---|---|---|
| `schools` | Registered schools and branding | `id` | Yes |
| `users` | Authentication identities for staff, parents, students, and admins | `school_id` except `super_admin` | Yes |
| `students` | Learner profiles and admission data | `school_id` | Yes |
| `staff` | Staff employment profile details | `school_id` | Yes |
| `payments` | Fee payments and receipt approval state | `school_id` | Yes |
| `finance_transactions` | Finance ledger-style transaction records | `school_id` | Yes |
| `attendance` | Raw attendance events | `school_id` | Archive, not delete |
| `attendance_summaries` | Aggregated attendance counts | `school_id` | Yes |
| `results` | Examination results | `school_id` | Yes |
| `assessment_templates` | CBC report template definitions | `school_id` or platform default | Yes |
| `assessment_reports` | CBC report instances per learner/exam/class | `school_id` | Yes |
| `assessment_results` | Learning-area scores and remarks | `school_id`, `report_id` | Yes |
| `competencies` | CBC competency assessments | `school_id`, `report_id` | Yes |
| `values` | CBC values assessments | `school_id`, `report_id` | Yes |
| `report_history` | Permanent report lifecycle history | `school_id` | Yes |
| `notifications` | In-app notification records | `school_id` | Archive |
| `support_tickets` | School support requests | `school_id` | Archive |
| `audit_logs` | Security and administrative actions | `school_id` where applicable | Archive |
| `file_assets` | Uploaded file metadata | `school_id` | Yes |
| `auth_sessions` | Refresh-token/session metadata | `school_id` | Temporary |
| `rate_limits` | Request throttling counters | N/A hashed key | Temporary |
| `login_attempts` | Login lockout counters | N/A hashed login key | Temporary |
| `password_reset_codes` | Password reset verification codes | `school_id` | Temporary |
| `staff_password_reset_requests` | Admin-mediated staff reset workflow | `school_id` | Operational |
| `dashboard_summaries` | Per-school dashboard counters | `school_id` | Rebuildable |
| `archive_manifests` | Archive export tracking | `school_id` | Yes |

## Date Fields

- New code should store `datetime` values in UTC where possible.
- Existing ISO string dates remain supported for backward compatibility.
- Query indexes should match the stored field type used by the endpoint.

## Identifier Rules

- Preserve existing UUID string `id` fields.
- Preserve compatibility with Mongo `_id` lookups where existing APIs support them.
- Every school-owned collection must include `school_id`.
