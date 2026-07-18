# Maintenance Scripts

The backend contains several root-level maintenance scripts. They should not be removed until ownership and operational usage are confirmed.

| Script | Current Treatment |
|---|---|
| `seed_demo_users.py` | Demo/local seed utility. |
| `seed_cbc_assessment_templates.py` | CBC template seed utility. |
| `cleanup_demo_database.py` | Demo data cleanup utility. |
| `fix_user_ids.py` | Data repair utility. |
| `fix_school_id.py` | Data repair utility. |
| `fix_approval.py` | Data repair utility. |
| `code fix_approval.py` | Appears duplicated or accidental; requires manual confirmation before removal. |
| `reset_users.py` | User maintenance utility. |
| `show_users.py` | Inspection utility. |
| `show_school_codes.py` | Inspection utility. |
| `check_hash.py` | Authentication/debug inspection utility. |

## Cleanup Rule

Before deleting a script:

1. Search references in docs, CI, deployment notes, and support workflows.
2. Confirm whether it was used for production data repair.
3. If retained, add usage instructions and safety notes.
4. If removed, mention the replacement workflow in the same commit.
