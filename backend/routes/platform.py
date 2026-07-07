from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId

from auth import get_current_user, db, hash_password


router = APIRouter(prefix="/api/platform", tags=["Platform Admin"])


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def school_lookup(school_id: str):
    conditions = [{"id": school_id}]
    if ObjectId.is_valid(school_id):
        conditions.append({"_id": ObjectId(school_id)})
    return {"$or": conditions}


def serialize_doc(doc: dict):
    if not doc:
        return doc
    out = {}
    for key, value in doc.items():
        if key == "_id":
            continue
        out[key] = value.isoformat() if isinstance(value, datetime) else value
    return out


def money(value):
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0


async def require_super_admin(user=Depends(get_current_user)):
    if user.get("role") != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super admin access required"
        )
    return user


async def log_action(action, user, school_id=None, metadata=None):
    await db.audit_logs.insert_one({
        "action": action,
        "performed_by": user.get("email"),
        "user_id": user.get("user_id"),
        "school_id": school_id,
        "metadata": metadata or {},
        "timestamp": now_iso()
    })


async def serialize_school(school: dict):
    school_id = str(school.get("id") or school.get("_id"))
    users = await db.users.find({"school_id": school_id}, {"_id": 0}).to_list(500)
    students_count = await db.students.count_documents({"school_id": school_id})
    payments = await db.payments.find({"school_id": school_id}, {"_id": 0}).to_list(500)
    invoices = await db.platform_invoices.find({"school_id": school_id}, {"_id": 0}).to_list(100)
    revenue = sum(money(p.get("amount")) for p in payments if p.get("status") in {"paid", "completed", "approved"})
    outstanding = sum(money(i.get("amount")) for i in invoices if i.get("status") in {"pending", "overdue"})
    admin = next((u for u in users if u.get("role") == "school_admin"), None)
    theme = school.get("theme") or {}

    return {
        "id": school_id,
        "mongo_id": str(school.get("_id")) if school.get("_id") else None,
        "name": school.get("name"),
        "logo_url": school.get("logo_url") or school.get("logo"),
        "school_code": school.get("school_code"),
        "school_type": school.get("school_type"),
        "administrator": admin.get("full_name") if admin else school.get("principal_name"),
        "administrator_email": admin.get("email") if admin else school.get("principal_email"),
        "current_subscription": school.get("subscription_plan") or "standard",
        "subscription_status": school.get("subscription_status") or "inactive",
        "registration_date": school.get("created_at"),
        "last_login": max([u.get("last_login") for u in users if u.get("last_login")] or [None]),
        "payment_status": school.get("payment_status") or "pending",
        "school_status": school.get("status") or ("active" if school.get("is_active") else "inactive"),
        "approval_status": school.get("approval_status") or "pending",
        "is_active": bool(school.get("is_active", False)),
        "email": school.get("email"),
        "phone": school.get("phone"),
        "address": school.get("address"),
        "login_link": school.get("login_link"),
        "theme": {
            "primary": theme.get("primary") or "#10B981",
            "secondary": theme.get("secondary") or "#0F172A",
        },
        "counts": {
            "users": len(users),
            "students": students_count,
            "payments": len(payments),
            "invoices": len(invoices),
        },
        "revenue": revenue,
        "outstanding": outstanding,
        "created_at": school.get("created_at"),
        "updated_at": school.get("updated_at"),
    }


@router.get("/metrics")
async def get_platform_metrics(user=Depends(require_super_admin)):
    schools = await db.schools.find({}).to_list(5000)
    users = await db.users.find({}).to_list(10000)
    payments = await db.payments.find({}).to_list(10000)
    invoices = await db.platform_invoices.find({}).to_list(5000)
    tickets = await db.support_tickets.find({}).to_list(5000)

    paid_revenue = sum(money(p.get("amount")) for p in payments if p.get("status") in {"paid", "completed", "approved"})
    invoice_revenue = sum(money(i.get("amount")) for i in invoices if i.get("status") == "paid")
    outstanding = sum(money(i.get("amount")) for i in invoices if i.get("status") in {"pending", "overdue"})

    today = datetime.now(timezone.utc).date().isoformat()

    return {
        "total_registered_schools": len(schools),
        "total_schools": len(schools),
        "active_schools": sum(1 for s in schools if s.get("is_active") is True),
        "suspended_schools": sum(1 for s in schools if str(s.get("status")).lower() == "suspended"),
        "trial_schools": sum(1 for s in schools if s.get("subscription_status") == "trial"),
        "monthly_revenue": paid_revenue + invoice_revenue,
        "outstanding_revenue": outstanding,
        "new_registrations": sum(1 for s in schools if str(s.get("created_at", "")).startswith(today)),
        "pending_approvals": sum(1 for s in schools if s.get("approval_status") == "pending"),
        "open_support_tickets": sum(1 for t in tickets if t.get("status", "open") == "open"),
        "system_health": "operational",
        "active_users": sum(1 for u in users if u.get("is_active") is not False),
        "daily_login_statistics": sum(1 for u in users if str(u.get("last_login", "")).startswith(today)),
        "total_users": len(users),
        "total_revenue": paid_revenue + invoice_revenue,
    }


@router.get("/system-health")
async def system_health(user=Depends(require_super_admin)):
    errors = await db.audit_logs.find({"action": {"$regex": "error", "$options": "i"}}, {"_id": 0}).sort("timestamp", -1).limit(20).to_list(20)
    alerts = await system_alerts(user)
    return {
        "database_status": "connected",
        "api_status": "ok",
        "authentication_status": "ok",
        "server_status": "running",
        "platform_status": "operational",
        "background_jobs": "ready",
        "latest_errors": errors,
        "alerts": alerts,
        "system_version": "1.0.0",
        "uptime": "online",
        "timestamp": now_iso(),
    }


@router.get("/schools")
async def get_all_schools(user=Depends(require_super_admin)):
    schools = []
    async for school in db.schools.find().sort("created_at", -1):
        schools.append(await serialize_school(school))
    return {"count": len(schools), "schools": schools}


@router.get("/schools/pending")
async def get_pending_schools(user=Depends(require_super_admin)):
    schools = []
    async for school in db.schools.find({"approval_status": "pending"}).sort("created_at", -1):
        schools.append(await serialize_school(school))
    return {"count": len(schools), "schools": schools}


@router.get("/schools/{school_id}")
async def get_school_detail(school_id: str, user=Depends(require_super_admin)):
    school = await db.schools.find_one(school_lookup(school_id))
    if not school:
        raise HTTPException(status_code=404, detail="School not found")

    school_id = str(school.get("id") or school_id)
    users = await db.users.find({"school_id": school_id}, {"_id": 0, "password_hash": 0, "temporary_password": 0}).to_list(1000)
    students = await db.students.count_documents({"school_id": school_id})
    staff = await db.users.count_documents({"school_id": school_id, "role": {"$in": ["teacher", "finance", "secretary"]}})
    payments = await db.payments.find({"school_id": school_id}, {"_id": 0}).sort("created_at", -1).limit(100).to_list(100)
    invoices = await db.platform_invoices.find({"school_id": school_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    tickets = await db.support_tickets.find({"school_id": school_id}, {"_id": 0}).sort("created_at", -1).limit(100).to_list(100)
    logs = await db.audit_logs.find({"school_id": school_id}, {"_id": 0}).sort("timestamp", -1).limit(100).to_list(100)

    detail = await serialize_school(school)
    detail.update({
        "general_information": serialize_doc(school),
        "branding": {
            "logo_url": school.get("logo_url"),
            "motto": school.get("motto"),
            "theme": school.get("theme") or {},
        },
        "subscription": {
            "plan": school.get("subscription_plan") or "standard",
            "status": school.get("subscription_status"),
            "amount": school.get("subscription_amount", 2000),
            "billing_day": school.get("billing_day"),
        },
        "students": {"count": students},
        "staff": {"count": staff, "users": users},
        "finance_summary": {
            "paid": sum(money(p.get("amount")) for p in payments if p.get("status") in {"paid", "completed", "approved"}),
            "outstanding": sum(money(i.get("amount")) for i in invoices if i.get("status") in {"pending", "overdue"}),
            "payments": payments,
            "invoices": invoices,
        },
        "system_usage": {"active_users": sum(1 for u in users if u.get("is_active") is not False)},
        "login_history": [u for u in users if u.get("last_login")],
        "api_usage": {"requests_today": 0},
        "storage_usage": {"used_mb": 0},
        "support_tickets": tickets,
        "audit_logs": logs,
        "recent_activities": logs[:10],
    })
    return detail


@router.patch("/schools/{school_id}/approve")
async def approve_school(school_id: str, user=Depends(require_super_admin)):
    school = await db.schools.find_one(school_lookup(school_id))
    if not school:
        raise HTTPException(status_code=404, detail="School not found")
    canonical_id = str(school.get("id") or school_id)
    now = now_iso()
    await db.schools.update_one(
        {"_id": school["_id"]},
        {"$set": {
            "approval_status": "approved",
            "status": "active",
            "is_active": True,
            "subscription_status": "active",
            "payment_status": "paid",
            "approved_at": now,
            "approved_by": user.get("user_id"),
            "updated_at": now,
        }}
    )
    await db.users.update_many(
        {"school_id": canonical_id},
        {"$set": {"approval_status": "approved", "is_active": True, "updated_at": now}}
    )
    await db.platform_invoices.update_many(
        {"school_id": canonical_id, "invoice_type": "installation"},
        {"$set": {"status": "paid", "paid_at": now, "updated_at": now}}
    )
    await log_action("school_approved", user, canonical_id)
    return {"message": "School and users approved successfully"}


@router.patch("/schools/{school_id}/suspend")
async def suspend_school(school_id: str, user=Depends(require_super_admin)):
    school = await db.schools.find_one(school_lookup(school_id))
    if not school:
        raise HTTPException(status_code=404, detail="School not found")
    canonical_id = str(school.get("id") or school_id)
    await db.schools.update_one({"_id": school["_id"]}, {"$set": {"status": "suspended", "is_active": False, "subscription_status": "suspended", "updated_at": now_iso()}})
    await log_action("school_suspended", user, canonical_id)
    return {"message": "School suspended"}


@router.patch("/schools/{school_id}/activate")
async def activate_school(school_id: str, user=Depends(require_super_admin)):
    school = await db.schools.find_one(school_lookup(school_id))
    if not school:
        raise HTTPException(status_code=404, detail="School not found")
    canonical_id = str(school.get("id") or school_id)
    await db.schools.update_one({"_id": school["_id"]}, {"$set": {"approval_status": "approved", "status": "active", "is_active": True, "subscription_status": "active", "updated_at": now_iso()}})
    await log_action("school_activated", user, canonical_id)
    return {"message": "School activated"}


@router.patch("/schools/{school_id}/toggle")
async def toggle_school_status(school_id: str, user=Depends(require_super_admin)):
    school = await db.schools.find_one(school_lookup(school_id))
    if not school:
        raise HTTPException(status_code=404, detail="School not found")
    return await (suspend_school if school.get("is_active") else activate_school)(school_id, user)


@router.post("/schools/{school_id}/reset-password")
async def reset_school_admin_password(school_id: str, data: dict, user=Depends(require_super_admin)):
    school = await db.schools.find_one(school_lookup(school_id))
    if not school:
        raise HTTPException(status_code=404, detail="School not found")
    canonical_id = str(school.get("id") or school_id)
    password = data.get("password") or "SmartMHub123"
    result = await db.users.update_one(
        {"school_id": canonical_id, "role": "school_admin"},
        {"$set": {"password_hash": hash_password(password), "temporary_password": password, "updated_at": now_iso()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="School admin not found")
    await log_action("school_admin_password_reset", user, canonical_id)
    return {"message": "Password reset", "temporary_password": password}


@router.get("/schools/{school_id}/users")
async def school_users(school_id: str, user=Depends(require_super_admin)):
    school = await db.schools.find_one(school_lookup(school_id))
    if not school:
        raise HTTPException(status_code=404, detail="School not found")
    canonical_id = str(school.get("id") or school_id)
    users = await db.users.find({"school_id": canonical_id}, {"_id": 0, "password_hash": 0, "temporary_password": 0}).to_list(1000)
    return {"count": len(users), "users": users}


@router.get("/payments/summary")
async def payment_summary(user=Depends(require_super_admin)):
    payments = await db.payments.find({}, {"_id": 0}).sort("created_at", -1).limit(500).to_list(500)
    invoices = await db.platform_invoices.find({}, {"_id": 0}).sort("created_at", -1).limit(500).to_list(500)
    return {
        "installation_fees": sum(money(i.get("amount")) for i in invoices if i.get("invoice_type") == "installation"),
        "monthly_subscriptions": sum(money(i.get("amount")) for i in invoices if i.get("invoice_type") == "subscription"),
        "pending_payments": sum(1 for i in invoices if i.get("status") == "pending"),
        "overdue_schools": await db.schools.count_documents({"subscription_status": "expired"}),
        "payment_history": payments,
        "invoices": invoices,
        "revenue_charts": monthly_buckets(payments + invoices),
        "totalPayments": len(payments) + len(invoices),
        "totalRevenue": sum(money(p.get("amount")) for p in payments if p.get("status") in {"paid", "completed", "approved"}) + sum(money(i.get("amount")) for i in invoices if i.get("status") == "paid"),
        "pendingPayments": sum(1 for p in payments if p.get("status") == "pending") + sum(1 for i in invoices if i.get("status") == "pending"),
    }


def monthly_buckets(records):
    buckets = {}
    for record in records:
        raw = str(record.get("created_at") or record.get("paid_at") or "")[:7] or "unknown"
        buckets.setdefault(raw, 0)
        buckets[raw] += money(record.get("amount"))
    return [{"month": key, "amount": value} for key, value in sorted(buckets.items())]


@router.get("/analytics")
async def analytics(user=Depends(require_super_admin)):
    schools = await db.schools.find({}, {"_id": 0}).to_list(5000)
    students = await db.students.find({}, {"_id": 0}).to_list(10000)
    users = await db.users.find({}, {"_id": 0}).to_list(10000)
    payments = await db.payments.find({}, {"_id": 0}).to_list(10000)
    return {
        "revenue": monthly_buckets(payments),
        "school_growth": monthly_count(schools),
        "student_growth": monthly_count(students),
        "user_growth": monthly_count(users),
        "monthly_registrations": monthly_count(schools),
        "system_usage": {"users": len(users), "students": len(students), "schools": len(schools)},
        "most_active_schools": sorted(
            [{"name": s.get("name"), "active_users": s.get("active_users_count", 0)} for s in schools],
            key=lambda x: x["active_users"],
            reverse=True
        )[:10],
        "most_active_users": sorted(
            [{"name": u.get("full_name"), "email": u.get("email"), "last_login": u.get("last_login")} for u in users],
            key=lambda x: str(x.get("last_login") or ""),
            reverse=True
        )[:10],
    }


def monthly_count(records):
    buckets = {}
    for record in records:
        key = str(record.get("created_at") or "")[:7] or "unknown"
        buckets[key] = buckets.get(key, 0) + 1
    return [{"month": key, "count": value} for key, value in sorted(buckets.items())]


@router.get("/support-tickets")
async def get_tickets(user=Depends(require_super_admin)):
    tickets = await db.support_tickets.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return tickets


@router.post("/support-tickets")
async def create_ticket(data: dict, user=Depends(require_super_admin)):
    ticket = {
        "id": str(ObjectId()),
        "school_id": data.get("school_id"),
        "subject": data.get("subject") or "Platform support",
        "message": data.get("message"),
        "priority": data.get("priority") or "normal",
        "status": "open",
        "assigned_to": data.get("assigned_to"),
        "replies": [],
        "internal_notes": [],
        "resolution_history": [],
        "created_at": now_iso(),
    }
    await db.support_tickets.insert_one(ticket)
    return {"message": "Ticket created successfully", "ticket": serialize_doc(ticket)}


@router.patch("/support-tickets/{ticket_id}")
async def update_ticket(ticket_id: str, data: dict, user=Depends(require_super_admin)):
    update = {"updated_at": now_iso()}
    for field in ["status", "priority", "assigned_to"]:
        if field in data:
            update[field] = data[field]
    push = {}
    if data.get("reply"):
        push["replies"] = {"message": data["reply"], "by": user.get("email"), "created_at": now_iso()}
    if data.get("internal_note"):
        push["internal_notes"] = {"note": data["internal_note"], "by": user.get("email"), "created_at": now_iso()}
    if data.get("resolution"):
        push["resolution_history"] = {"resolution": data["resolution"], "by": user.get("email"), "created_at": now_iso()}
    operation = {"$set": update}
    if push:
        operation["$push"] = push
    await db.support_tickets.update_one({"$or": [{"id": ticket_id}, {"_id": ObjectId(ticket_id) if ObjectId.is_valid(ticket_id) else ticket_id}]}, operation)
    return {"message": "Ticket updated successfully"}


@router.get("/alerts")
async def system_alerts(user=Depends(require_super_admin)):
    alerts = []
    pending = await db.schools.count_documents({"approval_status": "pending"})
    expired = await db.schools.count_documents({"subscription_status": "expired"})
    failed = await db.payments.count_documents({"status": "failed"})
    if pending:
        alerts.append({"type": "warning", "message": f"{pending} schools pending approval"})
    if expired:
        alerts.append({"type": "critical", "message": f"{expired} schools have expired subscriptions"})
    if failed:
        alerts.append({"type": "warning", "message": f"{failed} failed payments detected"})
    return alerts


@router.get("/platform-control")
async def platform_control(user=Depends(require_super_admin)):
    settings = await db.platform_settings.find_one({}, {"_id": 0}) or {}
    return {
        "platform_settings": settings,
        "subscription_plans": settings.get("subscription_plans", [{"name": "Standard", "monthly_amount": 2000, "installation_fee": 5000}]),
        "pricing": {"installation_fee": 5000, "monthly_subscription": 2000},
        "global_announcements": await db.global_announcements.find({}, {"_id": 0}).sort("created_at", -1).to_list(100),
        "maintenance_mode": bool(settings.get("maintenance_mode", False)),
        "system_configuration": settings.get("system_configuration", {}),
        "feature_flags": settings.get("feature_flags", {}),
    }


@router.patch("/platform-control")
async def update_platform_control(data: dict, user=Depends(require_super_admin)):
    await db.platform_settings.update_one({}, {"$set": {**data, "updated_at": now_iso()}}, upsert=True)
    await log_action("platform_settings_updated", user)
    return {"message": "Platform settings updated"}


@router.patch("/schools/{school_id}/subscription")
async def update_subscription(school_id: str, data: dict, user=Depends(require_super_admin)):
    school = await db.schools.find_one(school_lookup(school_id))
    if not school:
        raise HTTPException(status_code=404, detail="School not found")
    await db.schools.update_one(
        {"_id": school["_id"]},
        {"$set": {"subscription_status": data.get("status"), "subscription_plan": data.get("plan"), "updated_at": now_iso()}}
    )
    await log_action("subscription_updated", user, str(school.get("id") or school_id), data)
    return {"message": "Subscription updated"}


@router.post("/run-billing-check")
async def billing_check(user=Depends(require_super_admin)):
    result = await db.schools.update_many(
        {"subscription_status": "expired"},
        {"$set": {"is_active": False, "status": "subscription_expired", "updated_at": now_iso()}}
    )
    await log_action("billing_check_completed", user, metadata={"disabled_schools": result.modified_count})
    return {"message": "Billing check completed", "disabled_schools": result.modified_count}


@router.get("/audit-logs")
async def get_audit_logs(user=Depends(require_super_admin)):
    logs = await db.audit_logs.find({}, {"_id": 0}).sort("timestamp", -1).limit(500).to_list(500)
    return logs
