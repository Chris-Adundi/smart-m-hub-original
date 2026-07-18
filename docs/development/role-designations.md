# Roles And Staff Designations

## System Roles

System roles control authorization and portal access:

- `super_admin`
- `school_admin`
- `teacher`
- `finance`
- `secretary`
- `supporting_staff`
- `student`
- `parent`

## Staff Authentication Roles

Only these roles may be assigned to staff accounts by School Admin:

- `teacher`
- `finance`
- `secretary`
- `supporting_staff`

## Staff Designations

Designations describe employment responsibilities and must not grant permissions by themselves.

Examples:

- Principal
- Deputy Principal
- Librarian
- Nurse
- Games Teacher
- Laboratory Technician
- ICT Officer
- Driver
- Security Officer
- Cook
- Cleaner

## Implementation Rule

Authorization must check system roles only. User-facing staff titles should be stored in `designation`, `position`, `department`, or `staff_category`.
