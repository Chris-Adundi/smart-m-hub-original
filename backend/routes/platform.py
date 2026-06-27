from fastapi import APIRouter, Depends, HTTPException
from bson import ObjectId

from auth import get_current_user, require_roles, db
from datetime import datetime, timezone
from fastapi import Depends, HTTPException, status
from auth import get_current_user
from fastapi import Depends, HTTPException, status
from auth import get_current_user
from datetime import datetime, timezone

async def log_action(action, user, school_id=None):
    await db["audit_logs"].insert_one({
        "action": action,
        "performed_by": user,
        "school_id": school_id,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
router = APIRouter(prefix="/api/platform", tags=["Platform Admin"])

def require_super_admin(user=Depends(get_current_user)):
    if user.get("role") != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super admin access required"
        )
    return user

# =====================================================
# PLATFORM METRICS
# =====================================================
@router.get("/metrics")
async def get_platform_metrics():
    schools_col = db["schools"]
    users_col = db["users"]
    payments_col = db["payments"]

    total_schools = await schools_col.count_documents({})
    active_schools = await schools_col.count_documents({"is_active": True})
    inactive_schools = await schools_col.count_documents({"is_active": False})

    total_users = await users_col.count_documents({})

    total_revenue = 0
    async for p in payments_col.find({"status": "paid"}):
        total_revenue += p.get("amount", 0)

    return {
        "total_schools": total_schools,
        "active_schools": active_schools,
        "inactive_schools": inactive_schools,
        "total_users": total_users,
        "total_revenue": total_revenue
    }


@router.get("/system-health")
async def system_health(user=Depends(require_super_admin)):
    return {
        "status": "operational",
        "database": "connected",
        "services": {
            "auth": "ok",
            "api": "ok",
            "platform": "ok"
        },
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

# =====================================================
# ALL SCHOOLS
# =====================================================
@router.get("/schools")
async def get_all_schools(current_user=Depends(get_current_user)):
    if current_user["role"] != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    schools = []
    async for s in db["schools"].find():
        schools.append({
            "id": str(s.get("_id")),
            "name": s.get("name"),
            "is_active": s.get("is_active", False),
            "created_at": s.get("created_at")
        })

    return {
        "count": len(schools),
        "schools": schools
    }


# =====================================================
# SCHOOL DETAIL
# =====================================================

@router.get("/schools/pending")
async def get_pending_schools(current_user=Depends(get_current_user)):
    print("CURRENT USER =", current_user)

    schools = []

    async for s in db["schools"].find({"approval_status": "pending"}):
        schools.append({
            "id": str(s.get("_id")),
            "name": s.get("name"),
            "created_at": s.get("created_at")
        })

    return {
        "current_user": current_user,
        "count": len(schools),
        "schools": schools
    }

@router.get("/schools/{school_id}")
async def get_school_detail(school_id: str, current_user=Depends(get_current_user)):
    if current_user["role"] != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")

    school = await db["schools"].find_one({"_id": ObjectId(school_id)})

    if not school:
        raise HTTPException(status_code=404, detail="School not found")

    users_count = await db["users"].count_documents({"school_id": school_id})

    return {
        "id": str(school["_id"]),
        "name": school.get("name"),
        "is_active": school.get("is_active"),
        "users_count": users_count,
        "created_at": school.get("created_at")
    }


# =====================================================
# TOGGLE SCHOOL STATUS
# =====================================================
@router.patch("/schools/{school_id}/toggle")
async def toggle_school_status(school_id: str, current_user=Depends(get_current_user)):
    if current_user["role"] != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")

    school = await db["schools"].find_one({"_id": ObjectId(school_id)})

    if not school:
        raise HTTPException(status_code=404, detail="School not found")

    new_status = not school.get("is_active", False)

    await db["schools"].update_one(
        {"_id": ObjectId(school_id)},
        {"$set": {"is_active": new_status}}
    )

    return {
        "message": "School status updated",
        "is_active": new_status
    }


@router.patch("/schools/{school_id}/approve")
async def approve_school(school_id: str, current_user=Depends(get_current_user)):
    if current_user["role"] != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")

    school = await db["schools"].find_one({"_id": ObjectId(school_id)})

    if not school:
        raise HTTPException(status_code=404, detail="School not found")

    await db["schools"].update_one(
        {"_id": ObjectId(school_id)},
        {"$set": {"approval_status": "approved", "is_active": True}}
    )

    return {"message": "School approved successfully"}



@router.get("/payments/summary")
async def payment_summary(current_user=Depends(get_current_user)):
    print("PAYMENTS USER =", current_user)

    payments = db["payments"]

    total = await payments.count_documents({})

    pipeline = [
        {
            "$group": {
                "_id": None,
                "totalRevenue": {
                    "$sum": "$amount"
                }
            }
        }
    ]

    result = await payments.aggregate(pipeline).to_list(1)

    revenue = (
        result[0]["totalRevenue"]
        if result
        else 0
    )

    pending = await payments.count_documents({
        "status": "pending"
    })

    return {
        "current_user": current_user,
        "totalPayments": total,
        "totalRevenue": revenue,
        "pendingPayments": pending
    }

@router.get("/support-tickets")
async def get_tickets():
    tickets = []
    async for t in db["support_tickets"].find():
        tickets.append({
            "id": str(t.get("_id")),
            "school_id": t.get("school_id"),
            "message": t.get("message"),
            "status": t.get("status", "open"),
            "created_at": t.get("created_at")
        })
    return tickets


@router.get("/audit-logs")
async def get_audit_logs():
    logs = []
    async for log in db["audit_logs"].find().sort("timestamp", -1).limit(100):
        logs.append({
            "id": str(log.get("_id")),
            "action": log.get("action"),
            "performed_by": log.get("performed_by"),
            "school_id": log.get("school_id"),
            "timestamp": log.get("timestamp")
        })
    return logs


@router.get("/revenue")
async def get_revenue():
    total = 0
    pending = 0

    async for p in db["payments"].find():
        amount = p.get("amount", 0)

        if p.get("status") == "paid":
            total += amount
        else:
            pending += amount

    return {
        "total_revenue": total,
        "pending_revenue": pending
    }


@router.post("/support-tickets")
async def create_ticket(data: dict):
    ticket = {
        "school_id": data.get("school_id"),
        "message": data.get("message"),
        "status": "open",
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    await db["support_tickets"].insert_one(ticket)

    return {"message": "Ticket created successfully", "ticket_id": str(ticket.get("_id"))}
@router.patch("/support-tickets/{ticket_id}")
async def update_ticket(ticket_id: str, data: dict):
    await db["support_tickets"].update_one(
        {"_id": ticket_id},
        {"$set": {"status": data.get("status")}}
    )

    return {"message": "Ticket updated successfully"}


@router.get("/alerts")
async def system_alerts():
    alerts = []

    inactive_schools = await db["schools"].count_documents({"is_active": False})

    if inactive_schools > 0:
        alerts.append({
            "type": "warning",
            "message": f"{inactive_schools} inactive schools detected"
        })

    failed_payments = await db["payments"].count_documents({"status": "failed"})

    if failed_payments > 0:
        alerts.append({
            "type": "critical",
            "message": f"{failed_payments} failed payments detected"
        })

    return alerts


@router.patch("/schools/{school_id}/subscription")
async def update_subscription(school_id: str, data: dict, user=Depends(require_super_admin)):
    await db["schools"].update_one(
        {"_id": school_id},
        {
            "$set": {
                "subscription_status": data.get("status"),
                "plan": data.get("plan")
            }
        }
    )

    await log_action("subscription_updated", user.get("email"), school_id)

    return {"message": "subscription updated"}


@router.post("/run-billing-check")
async def billing_check(user=Depends(require_super_admin)):
    expired = 0

    async for school in db["schools"].find():
        if school.get("subscription_status") == "expired":
            await db["schools"].update_one(
                {"_id": school["_id"]},
                {"$set": {"is_active": False}}
            )
            expired += 1

    return {
        "message": "billing check completed",
        "disabled_schools": expired
    }


@router.get("/audit-logs")
async def get_audit_logs(user=Depends(require_super_admin)):
    logs = []

    async for log in db["audit_logs"].find().sort("timestamp", -1).limit(200):
        logs.append({
            "action": log.get("action"),
            "performed_by": log.get("performed_by"),
            "school_id": log.get("school_id"),
            "timestamp": log.get("timestamp")
        })

    return logs