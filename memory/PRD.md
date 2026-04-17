# Smart-M Hub Original - Product Requirements Document

## Overview
Multi-tenant School Management System supporting primary/secondary schools and colleges.

## Architecture
- **Frontend**: React.js + Tailwind CSS + Shadcn/UI (Dark Theme)
- **Backend**: FastAPI + MongoDB (Motor async)
- **Auth**: JWT-based with role-based access control

## Design System (Dark Theme)
- **Background**: #0B1120 (dark navy)
- **Card Surface**: #1A2332
- **Sidebar**: #111827
- **Primary Accent**: Emerald (#10B981)
- **Input Background**: #0F1A2A
- **Border**: #1E293B
- **Text Primary**: White
- **Text Secondary**: Slate-400

## Roles (RBAC)
1. **Super Admin** - Platform-wide management
2. **School Admin** - School management, approves ALL data entries
3. **Teacher** - Record results (CBE), mark attendance, view students
4. **Finance** - Record payments, track fees
5. **Secretary** - Register students (with full health info & 2 guardians), create announcements
6. **Parent/Student** - View-only portal (fees, results, attendance, announcements)

## Core Workflows

### Admin Approval Workflow (Implemented)
- All data created by Teacher/Finance/Secretary defaults to `approval_status: pending`
- Admin-created data is auto-approved
- Admin Dashboard shows tabbed pending approval queue
- Admin can Approve/Reject each item

### CBE Grading System (Implemented)
- **EE** - Exceeding Expectations (80%+)
- **ME** - Meeting Expectations (60-79%)
- **AE** - Approaching Expectations (40-59%)
- **BE** - Below Expectations (0-39%)

### Role-Based Login (Implemented)
- Users select their role card first, then see login form
- Password show/hide toggle included

## What's Been Implemented

### Phase 1 (April 12, 2026)
- [x] Admin Approval Workflow for all data types
- [x] Secretary Role & Portal (student records with health info, announcements)
- [x] CBE Grading System (EE, ME, AE, BE)
- [x] Teacher View Progress fix (dialog with results table)
- [x] Role-based navigation (sidebar adapts per role)
- [x] Dashboard approval queue for Admin
- [x] Legacy data migration for approval_status

### Dark Theme Overhaul (April 12, 2026)
- [x] Dark navy theme matching reference design
- [x] Role-based login page with 5 role cards
- [x] Password show/hide toggle
- [x] Dark sidebar with emerald active states
- [x] All pages updated to dark theme (Dashboard, Students, Staff, Fees, Attendance, Performance, Announcements, Teacher Portal, Secretary Portal, Finance Portal, Student Portal, Register)

## Backlog

### P0 (High Priority)
- [ ] Student/Parent Portal upgrade (view fee balance, results, attendance, teacher comments)
- [ ] M-Pesa subscription integration (to +254702641920) - SKIPPED per user request

### P1 (Medium Priority)
- [ ] Finance System Enhancement (income/expenditure tracker, running balance, school stamp upload)
- [ ] Student Progression System (auto-move yearly, historical records)
- [ ] Staff Management + Attendance merge (Time In/Out, Leave status tracking)
- [ ] File upload support (spreadsheets, timetables, documents)

### P2 (Low Priority)
- [ ] Package as ZIP "Smart-M hub Original"

## Key API Endpoints
- `POST /api/auth/login` - User login
- `POST /api/auth/register-school` - School registration
- `POST /api/students` - Create student (pending for non-admin)
- `GET /api/students` - List students (filtered by approval_status per role)
- `GET /api/admin/pending` - All pending items (Admin only)
- `PATCH /api/admin/approve/{type}/{id}` - Approve/reject item
- `POST /api/results` - Record result with CBE grade
- `POST /api/attendance` - Mark attendance
- `POST /api/payments/initiate` - Record payment
- `POST /api/announcements` - Create announcement

## Test Credentials
See /app/memory/test_credentials.md
