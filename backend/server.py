from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

import os
import logging
import uuid
import re

from pathlib import Path
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime, timezone

# =====================================================
# MODELS
# =====================================================
from models import (
    School,
    User,
    Student,
    Staff,
    FeeStructure,
    Payment,
    Attendance,
    Exam,
    Result,
    Timetable,
    InventoryItem,
    Announcement,
    UserRole,
    SubscriptionStatus,
    PaymentStatus,
    AttendanceStatus,
    StudentStatus,
    SchoolType,
    PaymentMethod,
    ApprovalStatus,
    CBEGrade
)

# =====================================================
# AUTH
# =====================================================
from auth import (
    hash_password,
    verify_password,
    create_access_token,
    decode_token,
    get_current_user,
    require_roles,
    login_user
)

# =====================================================
# ROOT + ENV
# =====================================================
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# =====================================================
# DATABASE CONNECTION
# =====================================================
mongo_url = os.getenv("MONGO_URL", "mongodb://localhost:27017")
db_name = os.getenv("DB_NAME", "smart_m_hub")

if not isinstance(db_name, str) or not db_name.strip():
    raise ValueError("DB_NAME must be a valid string. Check your .env file.")

client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

# =====================================================
# FASTAPI APP SETUP
# =====================================================
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Super Admin (Vite)
        "http://localhost:3000",  # School Admin (React)
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =====================================================
# ROUTERS
# =====================================================
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# 🔥 PLATFORM ROUTER (SUPER ADMIN DASHBOARD)
from routes.platform import router as platform_router
app.include_router(platform_router)

# =====================================================
# LOGGING
# =====================================================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

logger = logging.getLogger(__name__)

# =====================================================
# CONSTANTS
# =====================================================
VALID_APPROVAL_STATUSES = [
    "pending",
    "approved",
    "rejected",
    "suspended"
]

VALID_SYSTEM_ROLES = [
    "super_admin",
    "school_admin",
    "teacher",
    "finance",
    "secretary",
    "student",
    "parent"
]

# =====================================================
# GENERAL HELPERS
# =====================================================
def generate_uuid() -> str:
    return str(uuid.uuid4())


def now_utc():
    return datetime.now(timezone.utc)


def now_iso():
    return now_utc().isoformat()
# =====================================================
# SERIALIZATION HELPERS
# =====================================================
def serialize_doc(doc: dict) -> dict:

    if not doc:
        return doc

    cleaned = {}

    for key, val in doc.items():

        # REMOVE MONGO ID
        if key == "_id":
            continue

        # DATETIME → ISO STRING
        if isinstance(val, datetime):
            cleaned[key] = val.isoformat()

        else:
            cleaned[key] = val

    return cleaned


def serialize_docs(docs: list) -> list:
    return [serialize_doc(doc) for doc in docs]


def ensure_id(doc: dict) -> dict:

    if doc and not doc.get("id"):
        doc["id"] = generate_uuid()

    return doc


# =====================================================
# ROLE NORMALIZATION
# =====================================================
def normalize_role(role: str) -> str:
    """
    Centralized role normalization.
    Prevents frontend/backend role mismatch.
    """

    if not role:
        return ""

    role = (
        str(role)
        .lower()
        .strip()
    )

    role_map = {

        # =========================
        # ADMINS
        # =========================
        "admin": "school_admin",
        "administrator": "school_admin",
        "principal": "school_admin",
        "headteacher": "school_admin",
        "schooladmin": "school_admin",

        # =========================
        # FINANCE
        # =========================
        "finance officer": "finance",
        "finance_officer": "finance",
        "accountant": "finance",
        "bursar": "finance",

        # =========================
        # TEACHERS
        # =========================
        "class teacher": "teacher",
        "subject teacher": "teacher",

        # =========================
        # SECRETARY
        # =========================
        "office secretary": "secretary",

        # =========================
        # PARENT
        # =========================
        "guardian": "parent",

        # =========================
        # DIRECT
        # =========================
        "teacher": "teacher",
        "finance": "finance",
        "secretary": "secretary",
        "student": "student",
        "parent": "parent",
        "school_admin": "school_admin",
        "super_admin": "super_admin",
    }

    normalized = role_map.get(role, role)

    if normalized not in VALID_SYSTEM_ROLES:
        return ""

    return normalized


# =====================================================
# APPROVAL STATUS HELPERS
# =====================================================
def normalize_approval_status(status_value: str) -> str:

    if not status_value:
        return "pending"

    status_value = (
        str(status_value)
        .lower()
        .strip()
    )

    if status_value not in VALID_APPROVAL_STATUSES:
        return "pending"

    return status_value


def can_login(user: dict) -> bool:

    if not user:
        return False

    approval_status = normalize_approval_status(
        user.get("approval_status", "pending")
    )

    is_active = bool(user.get("is_active", True))
    is_suspended = bool(user.get("is_suspended", False))

    role = normalize_role(user.get("role"))

    if not role:
        return False

    if approval_status != "approved":
        return False

    if not is_active:
        return False

    if is_suspended:
        return False

    return True


# =====================================================
# AUTHORIZATION HELPERS
# =====================================================
def require_roles(current_user: dict, allowed_roles: list):

    user_role = normalize_role(
        current_user.get("role")
    )

    normalized_roles = [
        normalize_role(role)
        for role in allowed_roles
    ]

    if user_role not in normalized_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to perform this action"
        )

    return True


def enforce_school_scope(
    current_user: dict,
    resource_school_id: str
):

    role = normalize_role(
        current_user.get("role")
    )

    # SUPER ADMIN BYPASS
    if role == "super_admin":
        return True

    user_school_id = str(
        current_user.get("school_id") or ""
    ).strip()

    resource_school_id = str(
        resource_school_id or ""
    ).strip()

    if not user_school_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Missing school context"
        )

    if user_school_id != resource_school_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied for this school resource"
        )

    return True


# =====================================================
# SCHOOL HELPERS
# =====================================================
def generate_school_slug(name: str) -> str:

    if not name:
        return ""

    slug = name.lower().strip()

    slug = re.sub(
        r"[^a-z0-9\s-]",
        "",
        slug
    )

    slug = re.sub(
        r"\s+",
        "-",
        slug
    )

    return slug


def generate_school_code() -> str:
    return str(uuid.uuid4()).split("-")[0].upper()


def generate_invite_code() -> str:
    return str(uuid.uuid4()).split("-")[1].upper()


# =====================================================
# REQUEST MODELS
# =====================================================
class RegisterSchoolRequest(BaseModel):

    name: str
    address: str
    phone: str
    email: EmailStr
    school_type: str

    logo_url: Optional[str] = None
    motto: Optional[str] = None
    vision: Optional[str] = None
    mission: Optional[str] = None
    principal_name: Optional[str] = None
    website: Optional[str] = None
    established_year: Optional[str] = None

    admin_name: str
    admin_email: EmailStr
    admin_phone: Optional[str] = None
    admin_password: str


class JoinSchoolRequest(BaseModel):

    invite_code: str
    role: str

    email: EmailStr
    password: str

    admission_number: Optional[str] = None


class LoginRequest(BaseModel):

    email: EmailStr
    password: str


class CreateStudentRequest(BaseModel):

    admission_number: str
    full_name: str
    date_of_birth: str

    gender: str

    class_name: Optional[str] = None
    year_of_study: Optional[str] = None
    stream: Optional[str] = None

    guardian_name: str
    guardian_phone: str

    guardian_email: Optional[EmailStr] = None
    guardian_relationship: Optional[str] = None

    secondary_guardian_name: Optional[str] = None
    secondary_guardian_phone: Optional[str] = None
    secondary_guardian_email: Optional[EmailStr] = None
    secondary_guardian_relationship: Optional[str] = None

    blood_type: Optional[str] = None
    allergies: Optional[str] = None
    chronic_conditions: Optional[str] = None
    disabilities: Optional[str] = None
    immunization_status: Optional[str] = None
    medical_info: Optional[str] = None

    status: Optional[str] = "active"


class CreateStaffRequest(BaseModel):

    full_name: str
    email: EmailStr
    phone: str

    employee_number: str

    department: str
    position: str

    role: UserRole

    password: str

    salary: Optional[float] = None
    joined_date: str


class InitiatePaymentRequest(BaseModel):

    phone_number: Optional[str] = None

    amount: float

    payment_type: str
    payment_method: str

    student_id: Optional[str] = None

    bank_reference: Optional[str] = None
    cheque_number: Optional[str] = None

    description: Optional[str] = None


class MarkAttendanceRequest(BaseModel):

    entity_type: str
    entity_id: str

    date: str

    status: AttendanceStatus

    remarks: Optional[str] = None


class CreateExamRequest(BaseModel):

    name: str

    class_name: Optional[str] = None
    year_of_study: Optional[str] = None

    term: str
    exam_number: str
    academic_year: str

    exam_date: str


class CreateAnnouncementRequest(BaseModel):

    title: str
    content: str

    target_audience: str

    target_class: Optional[str] = None

    priority: str = "normal"


class RecordResultRequest(BaseModel):

    exam_id: str
    student_id: str

    subject: str

    marks: float
    grade: str

    teacher_comments: Optional[str] = None


class ApprovalActionRequest(BaseModel):

    action: str
    reason: Optional[str] = None


class CreateTransactionRequest(BaseModel):

    transaction_type: str
    category: str

    amount: float
    description: str

    date: Optional[str] = None


class ProgressStudentsRequest(BaseModel):

    academic_year: str
    from_class: Optional[str] = None


# =========================
# SCHOOL ADMIN DASHBOARD
# =========================
@api_router.get("/school/profile")
async def get_school_profile(current_user: dict = Depends(get_current_user)):

    school_id = current_user.get("school_id")

    if not school_id:
        raise HTTPException(status_code=403, detail="No school assigned")

    school = await db.schools.find_one({"id": school_id})

    if not school:
        raise HTTPException(status_code=404, detail="School not found")

    # Build invite link
    invite_code = school.get("invite_code")
    school_name_slug = school.get("name", "").lower().replace(" ", "-")

    invite_link = f"https://your-app.com/join/{school_name_slug}?code={invite_code}"

    school["_id"] = str(school.get("_id")) if school.get("_id") else None

    return {
        "success": True,
        "data": {
            "id": school.get("id"),
            "name": school.get("name"),
            "email": school.get("email"),
            "phone": school.get("phone"),
            "address": school.get("address"),
            "school_type": school.get("school_type"),
            "invite_code": invite_code,
            "invite_link": invite_link,
            "logo": school.get("logo"),
            "subscription_status": school.get("subscription_status"),
        }
    }
from fastapi import UploadFile, File
import base64


@api_router.patch("/school/profile")
async def update_school_profile(
    name: str = None,
    phone: str = None,
    address: str = None,
    logo: UploadFile = File(None),
    current_user: dict = Depends(get_current_user)
):

    school_id = current_user.get("school_id")

    if not school_id:
        raise HTTPException(status_code=403, detail="No school assigned")

    update_data = {}

    if name:
        update_data["name"] = name

    if phone:
        update_data["phone"] = phone

    if address:
        update_data["address"] = address

    # Handle logo upload (base64 simple storage)
    if logo:
        content = await logo.read()
        encoded = base64.b64encode(content).decode("utf-8")
        update_data["logo"] = f"data:image/png;base64,{encoded}"

    update_data["updated_at"] = datetime.now(timezone.utc)

    await db.schools.update_one(
        {"id": school_id},
        {"$set": update_data}
    )

    return {
        "success": True,
        "message": "School profile updated successfully"
    }
# =========================
# SCHOOL PROFILE / FINGERPRINT
# =========================
@api_router.get("/school/me")
async def get_my_school(
    current_user: dict = Depends(get_current_user)
):

    # =========================
    # ROLE SECURITY
    # =========================
    require_roles(
        current_user,
        ["school_admin", "super_admin"]
    )

    # =========================
    # SCHOOL CONTEXT
    # =========================
    school_id = str(
        current_user.get("school_id") or ""
    ).strip()

    if not school_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No school assigned"
        )

    # =========================
    # FETCH SCHOOL
    # =========================
    school = await db.schools.find_one({
        "id": school_id
    })

    # fallback support for old records
    if not school:
        school = await db.schools.find_one({
            "_id": school_id
        })

    if not school:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="School not found"
        )

    # =========================
    # SECURITY ENFORCEMENT
    # =========================
    school = serialize_doc(school)

    enforce_school_scope(
        current_user,
        school.get("id")
    )

    # =========================
    # SAFE RESPONSE
    # =========================
    return {
        "success": True,

        "school": {
            "id": school.get("id"),

            "name": school.get("name"),

            "school_initials": school.get(
                "school_initials"
            ),

            "slug": school.get(
                "slug"
            ),

            "school_code": school.get(
                "school_code"
            ),

            "fingerprint_code": school.get(
                "fingerprint_code"
            ),

            "invite_code": school.get(
                "invite_code"
            ),

            "invite_link": school.get(
                "invite_link"
            ),

            "email": school.get("email"),

            "phone": school.get("phone"),

            "address": school.get("address"),

            "school_type": school.get(
                "school_type"
            ),

            "subscription_status": school.get(
                "subscription_status"
            ),

            "status": school.get("status"),

            "created_at": school.get(
                "created_at"
            ),

            "updated_at": school.get(
                "updated_at"
            )
        }
    }


# =========================
# DASHBOARD STATS (FIXED & CLEAN)
# =========================

from fastapi import Depends, HTTPException, status


@api_router.get("/dashboard/stats")
async def get_dashboard_stats(
    current_user: dict = Depends(get_current_user)
):

    # =========================
    # ROLE (TRUST AUTH LAYER)
    # =========================
    role = current_user.get("role", "").lower()

    allowed_roles = {"school_admin", "super_admin"}

    if role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # =========================
    # SCHOOL SCOPE FILTER (FIXED)
    # =========================
    school_filter = {}

    if role == "school_admin":

        school_id = current_user.get("school_id")

        if not school_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No school assigned"
            )

        # FORCE STRING CONSISTENCY (CRITICAL FIX)
        school_filter = {
            "school_id": str(school_id)
        }

    # =========================
    # USERS
    # =========================
    students_count = await db.students.count_documents(school_filter)

    teachers_count = await db.users.count_documents({
        **school_filter,
        "role": "teacher"
    })

    staff_count = await db.users.count_documents({
        **school_filter,
        "role": {"$in": ["teacher", "secretary", "finance"]}
    })

    pending_users_count = await db.users.count_documents({
        **school_filter,
        "approval_status": "pending"
    })

    approved_users_count = await db.users.count_documents({
        **school_filter,
        "approval_status": "approved"
    })

    rejected_users_count = await db.users.count_documents({
        **school_filter,
        "approval_status": "rejected"
    })

    suspended_users_count = await db.users.count_documents({
        **school_filter,
        "is_suspended": True
    })

    # =========================
    # ATTENDANCE
    # =========================
    present_today = await db.attendance.count_documents({
        **school_filter,
        "status": "present"
    })

    pending_attendance = await db.attendance.count_documents({
        **school_filter,
        "approval_status": "pending"
    })

    # =========================
    # OPERATIONS
    # =========================
    pending_results = await db.results.count_documents({
        **school_filter,
        "approval_status": "pending"
    })

    pending_payments = await db.payments.count_documents({
        **school_filter,
        "approval_status": "pending"
    })

    pending_announcements = await db.announcements.count_documents({
        **school_filter,
        "approval_status": "pending"
    })

    pending_inventory = await db.inventory.count_documents({
        **school_filter,
        "approval_status": "pending"
    })

    pending_operations = (
        pending_results +
        pending_attendance +
        pending_payments +
        pending_announcements +
        pending_inventory
    )

    # =========================
    # RESPONSE
    # =========================
    return {
        "success": True,

        "total_students": students_count,
        "total_staff": staff_count,
        "total_teachers": teachers_count,

        "pending_users": pending_users_count,
        "approved_users": approved_users_count,
        "rejected_users": rejected_users_count,
        "suspended_users": suspended_users_count,

        "present_today": present_today,

        "pending_results": pending_results,
        "pending_attendance": pending_attendance,
        "pending_payments": pending_payments,
        "pending_announcements": pending_announcements,
        "pending_inventory": pending_inventory,

        "pending_operations": pending_operations,

        "role": role,

        "school_scope": (
            current_user.get("school_id")
            if role == "school_admin"
            else "all_schools"
        )
    }


# =========================
# ADMIN PENDING USERS
# =========================
@api_router.get("/admin/pending-users")
async def get_pending_users(
    current_user: dict = Depends(get_current_user)
):

    # =========================
    # SECURITY (RBAC)
    # =========================
    require_roles(
        current_user,
        ["school_admin", "super_admin"]
    )

    role = normalize_role(current_user.get("role"))

    # =========================
    # BASE QUERY
    # =========================
    query = {
        "approval_status": "pending"
    }

    # =========================
    # SCHOOL SCOPING
    # =========================
    if role == "school_admin":

        school_id = str(
            current_user.get("school_id") or ""
        ).strip()

        if not school_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No school assigned"
            )

        query["school_id"] = school_id

    # =========================
    # FETCH DATA
    # =========================
    users = await db.users.find(
        query
    ).sort(
        "created_at", -1
    ).to_list(length=100)

    # =========================
    # RESPONSE
    # =========================
    return {
        "success": True,
        "data": serialize_docs(users)
    }


# =========================
# STAFF MANAGEMENT
# =========================
@api_router.get("/staff")
async def get_staff(
    current_user: dict = Depends(get_current_user)
):

    # =========================
    # SECURITY (RBAC)
    # =========================
    require_roles(
        current_user,
        ["school_admin", "super_admin"]
    )

    role = normalize_role(current_user.get("role"))

    # =========================
    # BASE QUERY
    # =========================
    query = {
        "role": "teacher"
    }

    # =========================
    # SCHOOL SCOPING
    # =========================
    if role == "school_admin":

        school_id = str(
            current_user.get("school_id") or ""
        ).strip()

        if not school_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No school assigned"
            )

        query["school_id"] = school_id

    # =========================
    # FETCH STAFF
    # =========================
    staff = await db.users.find(
        query
    ).sort(
        "created_at", -1
    ).to_list(length=200)

    # =========================
    # RESPONSE
    # =========================
    return {
        "success": True,
        "data": serialize_docs(staff)
    }


# =========================
# ADMIN DASHBOARD DATA
# =========================
@api_router.get("/admin/pending")
async def get_pending_items(
    current_user: dict = Depends(get_current_user)
):

    # =========================
    # SECURITY (RBAC)
    # =========================
    require_roles(
        current_user,
        ["school_admin", "super_admin"]
    )

    role = normalize_role(current_user.get("role"))

    # =========================
    # SCHOOL SCOPING
    # =========================
    school_filter = {}

    school_id = None

    if role == "school_admin":

        school_id = str(
            current_user.get("school_id") or ""
        ).strip()

        if not school_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No school assigned"
            )

        school_filter = {"school_id": school_id}

    # =========================
    # USERS
    # =========================
    pending_users = await db.users.find({
        **school_filter,
        "approval_status": "pending"
    }).sort(
        "created_at", -1
    ).to_list(length=100)

    approved_users = await db.users.find({
        **school_filter,
        "approval_status": "approved"
    }).sort(
        "created_at", -1
    ).to_list(length=100)

    rejected_users = await db.users.find({
        **school_filter,
        "approval_status": "rejected"
    }).sort(
        "created_at", -1
    ).to_list(length=100)

    suspended_users = await db.users.find({
        **school_filter,
        "is_suspended": True
    }).sort(
        "created_at", -1
    ).to_list(length=100)

    # =========================
    # OPERATIONS
    # =========================
    results = await db.results.find({
        **school_filter,
        "approval_status": "pending"
    }).sort(
        "created_at", -1
    ).to_list(length=100)

    attendance = await db.attendance.find({
        **school_filter,
        "approval_status": "pending"
    }).sort(
        "created_at", -1
    ).to_list(length=100)

    payments = await db.payments.find({
        **school_filter,
        "approval_status": "pending"
    }).sort(
        "created_at", -1
    ).to_list(length=100)

    announcements = await db.announcements.find({
        **school_filter,
        "approval_status": "pending"
    }).sort(
        "created_at", -1
    ).to_list(length=100)

    inventory = await db.inventory.find({
        **school_filter,
        "approval_status": "pending"
    }).sort(
        "created_at", -1
    ).to_list(length=100)

    # =========================
    # SERIALIZE ONCE (CLEANER + FASTER)
    # =========================
    return {
        "success": True,

        "data": {
            "users": {
                "pending": serialize_docs(pending_users),
                "approved": serialize_docs(approved_users),
                "rejected": serialize_docs(rejected_users),
                "suspended": serialize_docs(suspended_users),
            },

            "operations": {
                "results": serialize_docs(results),
                "attendance": serialize_docs(attendance),
                "payments": serialize_docs(payments),
                "announcements": serialize_docs(announcements),
                "inventory": serialize_docs(inventory),
            },

            "totals": {
                "pending_users": len(pending_users),
                "approved_users": len(approved_users),
                "rejected_users": len(rejected_users),
                "suspended_users": len(suspended_users),

                "results": len(results),
                "attendance": len(attendance),
                "payments": len(payments),
                "announcements": len(announcements),
                "inventory": len(inventory),

                "all_pending_operations": sum([
                    len(results),
                    len(attendance),
                    len(payments),
                    len(announcements),
                    len(inventory)
                ])
            }
        },

        "viewer_role": role,
        "school_scope": school_id if role == "school_admin" else "all_schools"
    }


# =========================
# APPROVAL ACTION
# =========================

@api_router.patch(
    "/admin/approve/{item_type}/{item_id}",
    operation_id="admin_approve_item_action"
)
async def approve_item(
    item_type: str,
    item_id: str,
    payload: ApprovalActionRequest,
    current_user: dict = Depends(get_current_user)
):

    # =========================
    # ROLE + USER CONTEXT
    # =========================
    role = normalize_role(current_user.get("role"))
    user_id = current_user.get("user_id")
    school_id = current_user.get("school_id")

    # =========================
    # ROLE AUTHORIZATION
    # =========================
    if role not in ["school_admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    # =========================
    # SCHOOL SCOPING
    # =========================
    school_filter = {}

    if role == "school_admin":
        if not school_id:
            raise HTTPException(status_code=403, detail="No school assigned")

        school_filter = {"school_id": school_id}

    # =========================
    # VALIDATE ACTION
    # =========================
    action = (payload.action or "").lower().strip()

    if action not in ["approved", "rejected"]:
        raise HTTPException(
            status_code=400,
            detail="Action must be approved or rejected"
        )

    # =========================
    # COLLECTION MAP
    # =========================
    collection_map = {
        "users": db.users,
        "students": db.students,
        "staff": db.staff,
        "results": db.results,
        "attendance": db.attendance,
        "payments": db.payments,
        "announcements": db.announcements,
        "transactions": db.transactions,
        "inventory": db.inventory
    }

    collection = collection_map.get(item_type)

    if not collection:
        raise HTTPException(
            status_code=400,
            detail="Invalid item type"
        )

    # =========================
    # FIND ITEM
    # =========================
    query = {
        "id": item_id,
        **school_filter
    }

    item = await collection.find_one(query)

    if not item:
        raise HTTPException(
            status_code=404,
            detail="Item not found"
        )

    # =========================
    # UPDATE PAYLOAD
    # =========================
    update_data = {
        "approval_status": action,
        "approved_by": user_id,
        "approval_role": role,
        "approval_reason": payload.reason,
        "approval_date": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }

    # =========================
    # USER-SPECIFIC LOGIC
    # =========================
    if item_type == "users":

        if action == "approved":
            update_data["is_active"] = True
            update_data["is_suspended"] = False

        elif action == "rejected":
            update_data["is_active"] = False
            update_data["is_suspended"] = True

    # =========================
    # UPDATE DB
    # =========================
    await collection.update_one(
        {"id": item_id},
        {"$set": update_data}
    )

    # =========================
    # FETCH UPDATED ITEM
    # =========================
    updated_item = await collection.find_one({"id": item_id})

    # =========================
    # RESPONSE
    # =========================
    return {
        "success": True,
        "message": f"{item_type} {action} successfully",
        "item_type": item_type,
        "item_id": item_id,
        "approval_status": action,
        "updated_item": serialize_doc(updated_item),
        "approved_by": user_id,
        "approval_role": role
    }


# =========================
# AUTH
# =========================

@api_router.post("/auth/register-school")
async def register_school(payload: RegisterSchoolRequest):

    try:

        # =========================
        # NORMALIZED INPUTS
        # =========================
        school_email = payload.email.lower().strip()
        admin_email = payload.admin_email.lower().strip()

        # =========================
        # DUPLICATE CHECKS (SAFE)
        # =========================
        existing_school = await db.schools.find_one({
            "email": school_email
        })

        if existing_school:
            raise HTTPException(status_code=400, detail="School already exists")

        existing_admin = await db.users.find_one({
            "email": admin_email
        })

        if existing_admin:
            raise HTTPException(status_code=400, detail="Admin email already exists")

        # =========================
        # IDENTITY HELPERS
        # =========================
        def generate_initials(name: str) -> str:
            return "".join(
                word[0].upper()
                for word in name.split()
                if word
            )

        def clean_slug(name: str) -> str:
            return name.lower().strip().replace(" ", "-")

        # =========================
        # CORE IDS
        # =========================
        school_id = str(uuid.uuid4())
        admin_id = str(uuid.uuid4())

        school_slug = generate_school_slug(payload.name)
        school_code = generate_school_code()
        invite_code = generate_invite_code()

        initials = generate_initials(payload.name)

        fingerprint = f"{initials}-{invite_code}"

        join_slug = f"{clean_slug(payload.name)}-{invite_code}"

        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
        invite_link = f"{frontend_url}/join/{join_slug}"

        now = datetime.now(timezone.utc)

        # =========================
        # SCHOOL OBJECT (CLEANED)
        # =========================
        school = {
            "id": school_id,
            "name": payload.name,
            "slug": school_slug,
            "school_code": school_code,

            "initials": initials,
            "invite_code": invite_code,
            "fingerprint": fingerprint,
            "join_slug": join_slug,
            "invite_link": invite_link,

            "address": payload.address,
            "phone": payload.phone,
            "email": school_email,
            "school_type": payload.school_type,

            "logo_url": payload.logo_url,
            "motto": payload.motto,
            "vision": payload.vision,
            "mission": payload.mission,
            "principal_name": payload.principal_name,
            "website": payload.website,
            "established_year": payload.established_year,

            "status": "active",
            "is_active": True,
            "approval_status": "approved",

            "blocked_users": [],

            "created_at": now,
            "updated_at": now
        }

        await db.schools.insert_one(school)

        # =========================
        # ADMIN USER
        # =========================
        admin = {
            "id": admin_id,
            "full_name": payload.admin_name,
            "email": admin_email,
            "phone": payload.admin_phone,

            "password_hash": hash_password(payload.admin_password),

            # ROLE SYSTEM (CRITICAL)
            "role": "school_admin",

            # RELATION
            "school_id": school_id,
            "school_name": payload.name,
            "school_fingerprint": fingerprint,

            # APPROVAL
            "approval_status": "approved",
            "is_active": True,
            "is_suspended": False,

            "last_login": None,

            "created_at": now,
            "updated_at": now
        }

        await db.users.insert_one(admin)

        # =========================
        # TOKEN (FIXED STRUCTURE)
        # =========================
        access_token = create_access_token({
            "user_id": admin_id,
            "email": admin_email,
            "role": "school_admin",
            "school_id": school_id,
            "fingerprint": fingerprint
        })

        # =========================
        # RESPONSE
        # =========================
        return {
            "success": True,
            "message": "School registered successfully",

            "school_id": school_id,
            "school_name": payload.name,
            "school_slug": school_slug,
            "school_code": school_code,

            "initials": initials,
            "invite_code": invite_code,
            "fingerprint": fingerprint,
            "join_slug": join_slug,
            "invite_link": invite_link,

            "access_token": access_token,
            "token_type": "bearer",

            "user": {
                "id": admin_id,
                "email": admin_email,
                "full_name": payload.admin_name,
                "role": "school_admin",
                "school_id": school_id,
                "school_name": payload.name,
                "approval_status": "approved",
                "is_active": True
            }
        }

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"School registration error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


# ─────────────────────────────────────────────
# ✅ ADD THIS BELOW (THIS IS THE FIX YOU NEEDED)
# ─────────────────────────────────────────────

from fastapi import HTTPException
import uuid


@api_router.post("/auth/join-school")
async def join_school(request: dict):

    try:

        # =========================
        # INPUT NORMALIZATION
        # =========================
        invite_code = (request.get("invite_code") or "").strip().upper()
        email = (request.get("email") or "").strip().lower()
        password = request.get("password") or ""
        full_name = (request.get("full_name") or "").strip()
        raw_role = (request.get("role") or "teacher")
        admission_number = (request.get("admission_number") or "").strip() or None

        role = normalize_role(raw_role).lower()

        # =========================
        # VALIDATION
        # =========================
        if not invite_code:
            raise HTTPException(status_code=400, detail="Invite code required")

        if not email or not password or not full_name:
            raise HTTPException(
                status_code=400,
                detail="Email, password, and full name are required"
            )

        # =========================
        # ROLE VALIDATION
        # =========================
        allowed_roles = ["teacher", "student", "parent", "finance", "secretary"]

        if role not in allowed_roles:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid role. Allowed roles: {allowed_roles}"
            )

        # =========================
        # FIND SCHOOL
        # =========================
        school = await db.schools.find_one({
            "invite_code": invite_code
        })

        if not school:
            raise HTTPException(status_code=404, detail="Invalid invite code")

        # =========================
        # SCHOOL STATUS CHECK
        # =========================
        if not school.get("is_active", True):
            raise HTTPException(status_code=403, detail="School is inactive")

        # =========================
        # SCHOOL ID (STANDARDIZED)
        # =========================
        school_id = school.get("id")

        if not school_id:
            raise HTTPException(status_code=500, detail="School record missing ID")

        school_id = str(school_id)

        school_name = school.get("name")

        school_fingerprint = school.get("fingerprint")

        # =========================
        # DUPLICATE CHECK
        # =========================
        existing = await db.users.find_one({
            "email": email,
            "school_id": school_id
        })

        if existing:
            raise HTTPException(
                status_code=400,
                detail="User already exists in this school"
            )

        # =========================
        # CREATE USER
        # =========================
        user = {
            "id": str(uuid.uuid4()),

            "school_id": school_id,
            "school_name": school_name,
            "school_fingerprint": school_fingerprint,

            "email": email,
            "full_name": full_name,

            "password_hash": hash_password(password),

            "role": role,

            # =========================
            # APPROVAL SYSTEM
            # =========================
            "approval_status": "pending",
            "is_active": False,
            "is_suspended": False,
            "is_blocked": False,

            # =========================
            # OPTIONAL DATA
            # =========================
            "admission_number": admission_number,

            # =========================
            # TIMESTAMPS
            # =========================
            "created_at": now_utc(),
            "updated_at": now_utc()
        }

        await db.users.insert_one(user)

        # =========================
        # RESPONSE
        # =========================
        return {
            "success": True,
            "message": "Account created successfully. Awaiting approval.",

            "user": {
                "id": user["id"],
                "email": email,
                "full_name": full_name,
                "role": role,
                "school_id": school_id,
                "school_name": school_name,
                "approval_status": "pending",
                "is_active": False
            }
        }

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Join school error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@api_router.post("/auth/login", operation_id="auth_login_user")
async def login(request: LoginRequest):
    try:
        email = (request.email or "").strip().lower()
        password = (request.password or "").strip()

        if not email or not password:
            raise HTTPException(status_code=400, detail="Email and password required")

        user = await db.users.find_one({"email": email})

        if not user:
            raise HTTPException(status_code=401, detail="Invalid email or password")

        user_id = user.get("id") or str(user.get("_id"))

        stored_hash = user.get("password_hash") or user.get("hashed_password")

        if not stored_hash or not verify_password(password, stored_hash):
            raise HTTPException(status_code=401, detail="Invalid email or password")

        db_role = normalize_role(user.get("role") or "")

        if user.get("is_active") is False:
            raise HTTPException(status_code=403, detail="Account disabled")

        if user.get("is_suspended") is True:
            raise HTTPException(status_code=403, detail="Account suspended")

        approval_status = (user.get("approval_status") or "pending").lower()

        if db_role != "school_admin" and approval_status != "approved":
            raise HTTPException(status_code=403, detail="Account not approved")

        school_id = user.get("school_id")

        school = None
        if school_id:
            school = await db.schools.find_one({"id": school_id}) or await db.schools.find_one({"_id": school_id})
            if school:
                school.pop("_id", None)

        await db.users.update_one(
            {"id": user_id},
            {"$set": {"last_login": now_iso(), "updated_at": now_iso()}}
        )

        token = create_access_token({
            "user_id": user_id,
            "email": email,
            "role": db_role,
            "school_id": school_id
        })

        return {
            "success": True,
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": user_id,
                "email": email,
                "full_name": user.get("full_name") or "User",
                "role": db_role,
                "school_id": school_id,
                "school_name": school.get("name") if school else None,
                "approval_status": approval_status,
                "is_active": user.get("is_active", True),
                "is_suspended": user.get("is_suspended", False)
            },
            "school": school
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"LOGIN ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail="Login failed")

# =========================================
# SCHOOL INVITE + UNIQUE LINKS
# =========================================

@api_router.get("/school/invite")
async def get_school_invite(
    current_user: dict = Depends(get_current_user)
):

    # =========================================
    # VALIDATE ROLE
    # =========================================

    role = normalize_role(current_user.get("role", ""))

    if role != "SCHOOL_ADMIN":
        raise HTTPException(
            status_code=403,
            detail="Forbidden"
        )

    # =========================================
    # GET SCHOOL ID
    # =========================================

    school_id = current_user.get("school_id")

    if not school_id:
        raise HTTPException(
            status_code=400,
            detail="School ID missing"
        )

    # =========================================
    # FIND SCHOOL
    # =========================================

    school = await db.schools.find_one({
        "id": school_id
    })

    if not school:
        raise HTTPException(
            status_code=404,
            detail="School not found"
        )

    # =========================================
    # INVITE CODE
    # =========================================

    invite_code = school.get("invite_code")

    if not invite_code:
        invite_code = uuid4().hex[:10].upper()

    # =========================================
    # SCHOOL SLUG
    # =========================================

    school_slug = school.get("school_slug")

    if not school_slug:

        school_name = school.get("name") or "school"

        base_slug = slugify(school_name)

        # Example:
        # green-hill-academy-a82f1c
        school_slug = f"{base_slug}-{uuid4().hex[:6]}"

    # =========================================
    # SAVE TO DATABASE
    # =========================================

    await db.schools.update_one(
        {"id": school_id},
        {
            "$set": {
                "invite_code": invite_code,
                "school_slug": school_slug,
                "updated_at": datetime.utcnow()
            }
        }
    )

    # =========================================
    # FRONTEND URL
    # =========================================

    frontend_url = os.getenv(
        "FRONTEND_URL",
        "http://localhost:3000"
    ).rstrip("/")

    # =========================================
    # SCHOOL LOGIN LINK
    # =========================================

    login_link = (
        f"{frontend_url}/school/"
        f"{school_slug}/login"
        f"?code={invite_code}"
    )

    # =========================================
    # SCHOOL PROFILE LINK
    # =========================================

    profile_link = (
        f"{frontend_url}/school/{school_slug}"
    )

    # =========================================
    # RESPONSE
    # =========================================

    return {
        "success": True,
        "school_id": school_id,
        "school_name": school.get("name"),
        "school_slug": school_slug,
        "invite_code": invite_code,

        # School-specific login
        "login_link": login_link,

        # School public profile
        "profile_link": profile_link
    }
# =========================
# ALL SCHOOLS (ADMIN VIEW)
# =========================
@api_router.get("/schools")
async def get_schools(
    current_user: dict = Depends(get_current_user)
):

    role = normalize_role(current_user.get("role"))

    if role not in ["super_admin", "school_admin"]:
        raise HTTPException(
            status_code=403,
            detail="Unauthorized"
        )

    query = {}

    if role == "school_admin":
        school_id = current_user.get("school_id")

        if not school_id:
            raise HTTPException(
                status_code=403,
                detail="No school assigned"
            )

        query["id"] = school_id

    schools = await db.schools.find(query).to_list(length=1000)

    # IMPORTANT FIX: use serializer only (no manual pop mix)
    return {
        "success": True,
        "data": serialize_docs(schools)
    }


# =========================
# SINGLE SCHOOL
# =========================
@api_router.get("/schools/{school_id}")
async def get_school(
    school_id: str,
    current_user: dict = Depends(get_current_user)
):

    role = normalize_role(current_user.get("role"))

    if role != "super_admin" and current_user.get("school_id") != school_id:
        raise HTTPException(
            status_code=403,
            detail="Unauthorized"
        )

    school = await db.schools.find_one({
        "id": school_id
    })

    if not school:
        raise HTTPException(
            status_code=404,
            detail="School not found"
        )

    return {
        "success": True,
        "data": serialize_doc(school)
    }


# =====================================================

@api_router.patch("/schools/{school_id}")
async def update_school(
    school_id: str,
    update_data: dict,
    current_user: dict = Depends(get_current_user)
):

    try:

        # =========================
        # ROLE NORMALIZATION
        # =========================
        role = normalize_role(current_user.get("role"))

        # =========================
        # ACCESS CONTROL
        # =========================
        if role not in ["super_admin", "school_admin"]:
            raise HTTPException(
                status_code=403,
                detail="Unauthorized"
            )

        # school_admin can only edit their own school
        if role == "school_admin":
            if current_user.get("school_id") != school_id:
                raise HTTPException(
                    status_code=403,
                    detail="Unauthorized"
                )

        # =========================
        # SAFE COPY
        # =========================
        update_data = dict(update_data or {})

        # =========================
        # REMOVE UNSAFE / IMMUTABLE FIELDS
        # =========================
        protected_fields = {
            "id",
            "_id",
            "email",
            "hashed_password",
            "password_hash",
            "school_code",
            "invite_code",
            "fingerprint",
            "join_slug",
            "created_at"
        }

        for field in protected_fields:
            update_data.pop(field, None)

        # =========================
        # VALIDATE SCHOOL EXISTS
        # =========================
        current_school = await db.schools.find_one({"id": school_id})

        if not current_school:
            raise HTTPException(
                status_code=404,
                detail="School not found"
            )

        # =========================
        # ONBOARDING SAFETY RULES
        # =========================
        if "onboarding_step" in update_data:

            current_step = current_school.get("onboarding_step", 1)
            requested_step = update_data["onboarding_step"]

            # prevent skipping steps
            if requested_step > current_step + 1:
                raise HTTPException(
                    status_code=400,
                    detail="Invalid onboarding progression"
                )

        # =========================
        # TIMESTAMP
        # =========================
        update_data["updated_at"] = now_utc()

        # =========================
        # UPDATE
        # =========================
        await db.schools.update_one(
            {"id": school_id},
            {"$set": update_data}
        )

        # =========================
        # FETCH UPDATED
        # =========================
        updated_school = await db.schools.find_one({"id": school_id})

        if not updated_school:
            raise HTTPException(
                status_code=404,
                detail="Failed to fetch updated school"
            )

        updated_school = serialize_doc(updated_school)

        # =========================
        # RESPONSE
        # =========================
        return {
            "success": True,
            "message": "School updated successfully",
            "school": updated_school,
            "onboarding": {
                "step": updated_school.get("onboarding_step", 1),
                "completed": updated_school.get("onboarding_step", 1) >= 3,
                "next": "/onboarding/complete-profile"
            }
        }

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"School update error: {str(e)}")

        raise HTTPException(
            status_code=500,
            detail="Internal server error"
        )
# Students (Secretary creates, Admin approves)

@api_router.post("/students")
async def create_student(
    request: CreateStudentRequest,
    current_user: dict = Depends(get_current_user)
):
    try:

        # =========================
        # SCHOOL SAFETY
        # =========================
        school_id = current_user.get("school_id")

        if not school_id:
            raise HTTPException(
                status_code=403,
                detail="No school assigned"
            )

        # =========================
        # ROLE ACCESS
        # =========================
        role = normalize_role(current_user.get("role"))

        allowed_roles = ["school_admin", "secretary", "teacher"]

        if role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail="Unauthorized"
            )

        # =========================
        # FIX: CONSISTENT USER ID
        # =========================
        actor_id = current_user.get("user_id") or current_user.get("id")

        is_admin = role == "school_admin"

        # =========================
        # DUPLICATE CHECK
        # =========================
        existing_student = await db.students.find_one({
            "school_id": school_id,
            "admission_number": request.admission_number
        })

        if existing_student:
            raise HTTPException(
                status_code=400,
                detail="Admission number already exists"
            )

        now = now_utc()

        # =========================
        # STUDENT OBJECT
        # =========================
        student_data = {
            "id": str(uuid.uuid4()),
            "school_id": school_id,

            "admission_number": request.admission_number,
            "full_name": request.full_name,
            "date_of_birth": datetime.fromisoformat(request.date_of_birth),
            "gender": request.gender,

            "class_name": request.class_name,
            "year_of_study": request.year_of_study,
            "stream": request.stream,

            "guardian_name": request.guardian_name,
            "guardian_phone": request.guardian_phone,
            "guardian_email": request.guardian_email,
            "guardian_relationship": request.guardian_relationship,

            "secondary_guardian_name": request.secondary_guardian_name,
            "secondary_guardian_phone": request.secondary_guardian_phone,
            "secondary_guardian_email": request.secondary_guardian_email,
            "secondary_guardian_relationship": request.secondary_guardian_relationship,

            "blood_type": request.blood_type,
            "allergies": request.allergies,
            "chronic_conditions": request.chronic_conditions,
            "disabilities": request.disabilities,
            "immunization_status": request.immunization_status,
            "medical_info": request.medical_info,

            "status": "active",

            # =========================
            # APPROVAL SYSTEM (STANDARDIZED)
            # =========================
            "approval_status": "approved" if is_admin else "pending",

            "submitted_by": actor_id,
            "approved_by": actor_id if is_admin else None,
            "approval_date": now if is_admin else None,

            "created_at": now,
            "updated_at": now
        }

        # =========================
        # SAVE STUDENT
        # =========================
        await db.students.insert_one(student_data)

        # =========================
        # FIX: CENTRAL APPROVAL SYSTEM ONLY
        # =========================
        if student_data["approval_status"] == "pending":

            await db.approvals.insert_one({
                "id": str(uuid.uuid4()),
                "type": "student",
                "item_id": student_data["id"],
                "school_id": school_id,
                "status": "pending",
                "submitted_by": actor_id,
                "created_at": now
            })

        return {
            "success": True,
            "message": "Student created successfully",
            "student_id": student_data["id"],
            "approval_status": student_data["approval_status"]
        }

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Create student error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


# =========================
# STUDENTS LIST (CLEAN + SAFE)
# =========================
@api_router.get("/students")
async def get_students(
    status: Optional[str] = None,
    approval_status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):

    school_id = current_user.get("school_id")

    if not school_id:
        raise HTTPException(
            status_code=403,
            detail="No school assigned"
        )

    role = normalize_role(current_user.get("role"))

    query = {
        "school_id": school_id
    }

    # =========================
    # ROLE RULES (UNCHANGED BUT CLEANED)
    # =========================
    if role == "school_admin":
        if approval_status and approval_status != "all":
            query["approval_status"] = approval_status

    elif role == "secretary":
        query["approval_status"] = (
            approval_status if approval_status and approval_status != "all"
            else {"$in": ["pending", "approved"]}
        )

    else:
        query["approval_status"] = "approved"

    if status and status != "all":
        query["status"] = status

    students = await db.students.find(
        query,
        {"_id": 0}
    ).to_list(length=1000)

    return {
        "success": True,
        "data": serialize_docs(students)
    }


# =====================================================
# STUDENT DETAIL
# =====================================================

@api_router.get("/students/{student_id}")
async def get_student(
    student_id: str,
    current_user: dict = Depends(get_current_user)
):

    # =========================
    # SCHOOL VALIDATION
    # =========================
    school_id = current_user.get("school_id")

    if not school_id:
        raise HTTPException(
            status_code=403,
            detail="No school assigned"
        )

    # =========================
    # ROLE NORMALIZATION
    # =========================
    role = normalize_role(current_user.get("role"))

    # =========================
    # FETCH STUDENT
    # =========================
    student = await db.students.find_one({
        "id": student_id,
        "school_id": school_id
    }, {"_id": 0})

    if not student:
        raise HTTPException(
            status_code=404,
            detail="Student not found"
        )

    # =========================
    # APPROVAL ACCESS CONTROL
    # =========================
    if student.get("approval_status") != "approved":
        if role not in ["school_admin", "secretary"]:
            raise HTTPException(
                status_code=403,
                detail="Not authorized to view unapproved student"
            )

    return student


# =====================================================
# UPDATE STUDENT (HARDENED VERSION)
# =====================================================

@api_router.put(
    "/students/{student_id}",
    operation_id="students_update_student"
)
async def update_student(
    student_id: str,
    update_data: dict,
    current_user: dict = Depends(get_current_user)
):

    try:

        # =========================
        # ROLE VALIDATION
        # =========================
        role = normalize_role(current_user.get("role"))

        if role not in ["school_admin", "secretary"]:
            raise HTTPException(
                status_code=403,
                detail="Unauthorized"
            )

        # =========================
        # SCHOOL VALIDATION
        # =========================
        school_id = current_user.get("school_id")

        if not school_id:
            raise HTTPException(
                status_code=403,
                detail="No school assigned"
            )

        # =========================
        # SAFE INPUT NORMALIZATION
        # =========================
        if not isinstance(update_data, dict):
            raise HTTPException(
                status_code=400,
                detail="Invalid update payload"
            )

        update_data = dict(update_data)

        # =========================
        # REMOVE PROTECTED FIELDS
        # =========================
        protected_fields = {
            "_id",
            "id",
            "school_id",
            "approval_status",
            "approved_by",
            "approval_date",
            "submitted_by",
            "created_at"
        }

        for field in protected_fields:
            update_data.pop(field, None)

        if not update_data:
            raise HTTPException(
                status_code=400,
                detail="No valid fields provided for update"
            )

        # =========================
        # FETCH STUDENT
        # =========================
        existing_student = await db.students.find_one({
            "id": student_id,
            "school_id": school_id
        })

        if not existing_student:
            raise HTTPException(
                status_code=404,
                detail="Student not found"
            )

        # =========================
        # SECRETARY RULE
        # =========================
        if role == "secretary":
            update_data["approval_status"] = "pending"
            update_data["approved_by"] = None
            update_data["approval_date"] = None

        # =========================
        # ADMIN RULE
        # =========================
        elif role == "school_admin":
            update_data.setdefault(
                "approval_status",
                existing_student.get("approval_status", "approved")
            )

        # =========================
        # TIMESTAMP
        # =========================
        update_data["updated_at"] = now_iso()

        # =========================
        # UPDATE STUDENT
        # =========================
        await db.students.update_one(
            {
                "id": student_id,
                "school_id": school_id
            },
            {"$set": update_data}
        )

        # =========================
        # AUDIT LOG
        # =========================
        await db.audit_logs.insert_one({
            "id": str(uuid.uuid4()),
            "type": "student_update",
            "student_id": student_id,
            "school_id": school_id,
            "updated_by": current_user.get("user_id") or current_user.get("id"),
            "changes": update_data,
            "created_at": now_iso()
        })

        # =========================
        # RETURN UPDATED STUDENT
        # =========================
        updated_student = await db.students.find_one({
            "id": student_id,
            "school_id": school_id
        }, {"_id": 0})

        return {
            "success": True,
            "message": "Student updated successfully",
            "student": updated_student
        }

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Update student error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error"
        )


# =====================================================

@api_router.patch("/students/{student_id}/status")
async def update_student_status(
    student_id: str,
    body: dict,
    current_user: dict = Depends(get_current_user)
):

    try:

        # =========================
        # ROLE VALIDATION
        # =========================
        role = normalize_role(current_user.get("role"))

        if role not in ["school_admin", "secretary"]:
            raise HTTPException(
                status_code=403,
                detail="Unauthorized"
            )

        # =========================
        # SCHOOL VALIDATION
        # =========================
        school_id = current_user.get("school_id")

        if not school_id:
            raise HTTPException(
                status_code=403,
                detail="No school assigned"
            )

        # =========================
        # INPUT VALIDATION
        # =========================
        if not isinstance(body, dict):
            raise HTTPException(
                status_code=400,
                detail="Invalid request body"
            )

        status_value = (body.get("status") or "").strip()

        if not status_value:
            raise HTTPException(
                status_code=400,
                detail="Status is required"
            )

        allowed_statuses = {
            "active",
            "inactive",
            "suspended",
            "graduated",
            "transferred"
        }

        if status_value not in allowed_statuses:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status. Allowed: {list(allowed_statuses)}"
            )

        # =========================
        # FETCH STUDENT
        # =========================
        existing_student = await db.students.find_one({
            "id": student_id,
            "school_id": school_id
        })

        if not existing_student:
            raise HTTPException(
                status_code=404,
                detail="Student not found"
            )

        # =========================
        # SAFE UPDATE PAYLOAD
        # =========================
        update_payload = {
            "status": status_value,
            "status_reason": body.get("reason") or None,
            "status_changed_by": current_user.get("user_id") or current_user.get("id"),
            "status_changed_at": now_iso(),
            "updated_at": now_iso()
        }

        # =========================
        # SECRETARY REQUIRES RE-APPROVAL
        # =========================
        if role == "secretary":
            update_payload.update({
                "approval_status": "pending",
                "approved_by": None,
                "approval_date": None
            })

        # =========================
        # UPDATE
        # =========================
        result = await db.students.update_one(
            {
                "id": student_id,
                "school_id": school_id
            },
            {"$set": update_payload}
        )

        if result.matched_count == 0:
            raise HTTPException(
                status_code=404,
                detail="Student not found"
            )

        # =========================
        # AUDIT LOG
        # =========================
        await db.audit_logs.insert_one({
            "id": str(uuid.uuid4()),
            "type": "student_status_change",
            "student_id": student_id,
            "school_id": school_id,
            "changed_by": current_user.get("user_id") or current_user.get("id"),
            "new_status": status_value,
            "reason": update_payload["status_reason"],
            "created_at": now_iso()
        })

        # =========================
        # RESPONSE (NO EXTRA DB CALL)
        # =========================
        return {
            "success": True,
            "message": "Student status updated successfully",
            "status": status_value,
            "status_reason": update_payload["status_reason"],
            "status_changed_at": update_payload["status_changed_at"]
        }

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Status update error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error"
        )


# ─── Staff ────────────────────────────────────────────────────────

# ─── Payments (Finance creates, Admin approves) ──────────────────

@api_router.post("/payments/initiate")
async def initiate_payment(
    request: InitiatePaymentRequest,
    current_user: dict = Depends(get_current_user)
):

    try:

        # =========================
        # SCHOOL VALIDATION
        # =========================
        school_id = current_user.get("school_id")

        if not school_id:
            raise HTTPException(
                status_code=403,
                detail="No school assigned"
            )

        # =========================
        # ROLE NORMALIZATION
        # =========================
        role = normalize_role(current_user.get("role"))

        # =========================
        # BASIC VALIDATION
        # =========================
        if request.amount <= 0:
            raise HTTPException(
                status_code=400,
                detail="Amount must be greater than 0"
            )

        # =========================
        # PHONE NORMALIZATION
        # =========================
        phone = None

        if request.phone_number:
            phone = request.phone_number.strip().replace(" ", "")

            if phone.startswith("0"):
                phone = "254" + phone[1:]
            elif phone.isdigit() and not phone.startswith("254"):
                phone = "254" + phone

        # =========================
        # PAYMENT METHOD VALIDATION
        # =========================
        allowed_methods = {"cash", "mpesa", "bank_transfer", "cheque"}

        method = (request.payment_method or "").lower().strip()

        if method not in allowed_methods:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid payment method. Allowed: {list(allowed_methods)}"
            )

        # =========================
        # APPROVAL LOGIC
        # =========================
        requires_approval = True
        auto_approve = role == "school_admin"

        payment_id = str(uuid.uuid4())
        user_id = current_user.get("user_id") or current_user.get("id")

        now = datetime.now(timezone.utc)

        payment = {
            "id": payment_id,
            "school_id": school_id,

            "student_id": request.student_id,
            "amount": request.amount,
            "payment_type": request.payment_type,
            "payment_method": method,

            "phone_number": phone,
            "bank_reference": request.bank_reference,
            "cheque_number": request.cheque_number,
            "description": request.description,

            # =========================
            # PAYMENT STATE
            # =========================
            "status": "pending",

            # =========================
            # APPROVAL STATE
            # =========================
            "approval_status": "approved" if auto_approve else "pending",
            "needs_review": requires_approval,

            # =========================
            # TRACKING
            # =========================
            "submitted_by": user_id,
            "approved_by": user_id if auto_approve else None,
            "approval_date": now if auto_approve else None,

            # =========================
            # AUDIT TRAIL
            # =========================
            "approval_history": [
                {
                    "action": "created",
                    "by": user_id,
                    "timestamp": now
                }
            ],

            "created_at": now,
            "updated_at": now
        }

        # =========================
        # SAVE PAYMENT
        # =========================
        await db.payments.insert_one(payment)

        # =========================
        # APPROVAL QUEUE SYNC
        # =========================
        if payment["approval_status"] == "pending":

            await db.approvals.insert_one({
                "id": str(uuid.uuid4()),
                "type": "payment",
                "item_id": payment_id,
                "school_id": school_id,
                "status": "pending",
                "submitted_by": user_id,
                "created_at": now
            })

        return {
            "success": True,
            "payment_id": payment_id,
            "message": "Payment recorded successfully",
            "status": payment["status"],
            "approval_status": payment["approval_status"]
        }

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Payment error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error"
        )
@app.get("/api/payments")
async def get_payments(current_user: dict = Depends(get_current_user)):
    try:
        school_id = current_user.get("school_id")

        if not school_id:
            raise HTTPException(status_code=403, detail="No school assigned")

        payments = await db.payments.find(
            {"school_id": school_id}
        ).to_list(1000)

        return {
            "success": True,
            "data": payments
        }

    except Exception as e:
        logger.error(f"Fetch payments error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error"
        )    
@api_router.post("/attendance")
async def mark_attendance(
    request: MarkAttendanceRequest,
    current_user: dict = Depends(get_current_user)
):

    try:

        # =========================
        # SCHOOL VALIDATION
        # =========================
        school_id = current_user.get("school_id")

        if not school_id:
            raise HTTPException(
                status_code=403,
                detail="No school assigned"
            )

        # =========================
        # ROLE NORMALIZATION (FIXED)
        # =========================
        role = normalize_role(current_user.get("role"))

        # =========================
        # ROLE VALIDATION
        # =========================
        allowed_roles = {
            "school_admin",
            "teacher",
            "admin",
            "super_admin"
        }

        if role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail="Unauthorized"
            )

        # =========================
        # DATE VALIDATION
        # =========================
        try:
            attendance_date = datetime.fromisoformat(request.date)
        except Exception:
            raise HTTPException(
                status_code=400,
                detail="Invalid date format (use ISO format YYYY-MM-DD)"
            )

        # =========================
        # ENTITY VALIDATION
        # =========================
        entity_type = (request.entity_type or "").lower().strip()

        if entity_type not in {"student", "staff"}:
            raise HTTPException(
                status_code=400,
                detail="entity_type must be 'student' or 'staff'"
            )

        # =========================
        # APPROVAL LOGIC
        # =========================
        auto_approve = role in {"school_admin", "admin", "super_admin"}

        user_id = current_user.get("user_id") or current_user.get("id")

        # =========================
        # BUILD ATTENDANCE RECORD
        # =========================
        attendance = {
            "id": str(uuid.uuid4()),
            "school_id": school_id,

            "entity_type": entity_type,
            "entity_id": request.entity_id,

            "date": attendance_date.isoformat(),
            "status": request.status,
            "remarks": request.remarks,

            "marked_by": user_id,

            # =========================
            # APPROVAL SYSTEM (UNIFIED)
            # =========================
            "approval_status": "approved" if auto_approve else "pending",
            "submitted_by": user_id,
            "approved_by": user_id if auto_approve else None,
            "approval_date": now_iso() if auto_approve else None,

            "created_at": now_iso(),
            "updated_at": now_iso()
        }

        # =========================
        # SAVE
        # =========================
        await db.attendance.insert_one(attendance)

        return {
            "success": True,
            "message": "Attendance marked successfully",
            "attendance_id": attendance["id"],
            "approval_status": attendance["approval_status"]
        }

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Attendance error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error"
        )


@api_router.get("/attendance")
async def get_attendance(
    date: Optional[str] = None,
    approval_status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):

    try:

        # =========================
        # SCHOOL VALIDATION
        # =========================
        school_id = current_user.get("school_id")

        if not school_id:
            raise HTTPException(
                status_code=403,
                detail="Unauthorized"
            )

        # =========================
        # ROLE NORMALIZATION (FIXED)
        # =========================
        role = normalize_role(current_user.get("role"))

        # =========================
        # BASE QUERY
        # =========================
        query = {
            "school_id": school_id
        }

        user_id = current_user.get("user_id") or current_user.get("id")

        # =========================
        # ROLE FILTERING (CLEAN + SAFE)
        # =========================
        if role in {"school_admin", "admin", "super_admin"}:
            # full visibility
            if approval_status and approval_status != "all":
                query["approval_status"] = approval_status.lower()

        elif role == "teacher":
            # teachers see only approved unless filtered
            query["approval_status"] = "approved"

            if approval_status and approval_status != "all":
                query["approval_status"] = approval_status.lower()

        else:
            # strict roles (parents/students/etc.)
            query["approval_status"] = "approved"

        # =========================
        # DATE FILTER (SAFE & CONSISTENT)
        # =========================
        if date:
            try:
                parsed_date = datetime.fromisoformat(date.split("T")[0])

                start = parsed_date.replace(
                    hour=0, minute=0, second=0, microsecond=0
                )

                end = parsed_date.replace(
                    hour=23, minute=59, second=59, microsecond=999999
                )

                # IMPORTANT:
                # we assume date stored as ISO string OR datetime
                query["date"] = {
                    "$gte": start.isoformat(),
                    "$lte": end.isoformat()
                }

            except Exception:
                raise HTTPException(
                    status_code=400,
                    detail="Invalid date format (use YYYY-MM-DD)"
                )

        # =========================
        # FETCH
        # =========================
        attendance_records = await db.attendance.find(
            query,
            {"_id": 0}
        ).to_list(length=1000)

        return {
            "success": True,
            "count": len(attendance_records),
            "data": attendance_records
        }

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Get attendance error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error"
        )

# ─── Exams ────────────────────────────────────────────────────────

# OLD LOGIN - DISABLED
# @api_router.post("/auth/login")
async def login_legacy(request: LoginRequest):
    try:
        email = (request.email or "").strip().lower()

        if not email:
            raise HTTPException(status_code=400, detail="Email is required")

        if not request.password:
            raise HTTPException(status_code=400, detail="Password is required")

        user = await db.users.find_one({"email": email})

        if not user:
            raise HTTPException(status_code=401, detail="Invalid email or password")

        # ✅ SAFE USER ID FIX (IMPORTANT)
        user_id = user.get("id") or str(user.get("_id"))

        stored_hash = user.get("password_hash")

        # HARD SAFETY CHECK
        if not isinstance(stored_hash, str) or not stored_hash.startswith("$2b$"):
            raise HTTPException(
                status_code=500,
                detail="Invalid password hash format in database"
            )

        # PASSWORD CHECK
        if not verify_password(request.password, stored_hash):
            raise HTTPException(status_code=401, detail="Invalid email or password")

        # ROLE
        db_role = user.get("role")

        # TOKEN
        token = create_access_token({
            "user_id": user_id,
            "email": user["email"],
            "role": db_role,
            "school_id": user.get("school_id")
        })

        return {
            "success": True,
            "access_token": token,
            "user": {
                "id": user_id,
                "email": user["email"],
                "role": db_role
            }
        }

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"LOGIN ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail="Login failed")

# =========================
# GET EXAMS (FIXED VERSION)
# =========================
async def login_legacy(request: LoginRequest):
    try:
        email = (request.email or "").strip().lower()
        password = (request.password or "").strip()

        user = await db.users.find_one({"email": email})

        if not user:
            raise HTTPException(status_code=401, detail="Invalid email or password")

        user_id = user.get("id") or str(user.get("_id"))

        stored_hash = user.get("password_hash")

        if not stored_hash or not verify_password(password, stored_hash):
            raise HTTPException(status_code=401, detail="Invalid email or password")

        token = create_access_token({
            "user_id": user_id,
            "email": email,
            "role": user.get("role"),
            "school_id": user.get("school_id")
        })

        return {
            "success": True,
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": user_id,
                "email": email,
                "role": user.get("role")
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"LOGIN ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail="Login failed")

# ─── Results ───────────────────────────────────────────────

@api_router.post("/results")
async def record_result(
    request: RecordResultRequest,
    current_user: dict = Depends(get_current_user)
):

    try:

        # =========================
        # SCHOOL VALIDATION
        # =========================
        school_id = current_user.get("school_id")

        if not school_id:
            raise HTTPException(status_code=403, detail="No school assigned")

        # =========================
        # ROLE NORMALIZATION (FIXED)
        # =========================
        role = normalize_role(current_user.get("role"))

        allowed_roles = ["school_admin", "teacher"]

        if role not in allowed_roles:
            raise HTTPException(status_code=403, detail="Unauthorized")

        # =========================
        # VALIDATE EXAM EXISTS
        # =========================
        exam = await db.exams.find_one({
            "id": request.exam_id,
            "school_id": school_id
        })

        if not exam:
            raise HTTPException(status_code=404, detail="Exam not found")

        # =========================
        # VALIDATE STUDENT EXISTS
        # =========================
        student = await db.students.find_one({
            "id": request.student_id,
            "school_id": school_id
        })

        if not student:
            raise HTTPException(status_code=404, detail="Student not found")

        # =========================
        # DUPLICATE CHECK
        # =========================
        existing = await db.results.find_one({
            "school_id": school_id,
            "exam_id": request.exam_id,
            "student_id": request.student_id,
            "subject": request.subject
        })

        if existing:
            raise HTTPException(
                status_code=400,
                detail="Result already exists for this student, exam and subject"
            )

        # =========================
        # GRADE VALIDATION
        # =========================
        try:
            grade = CBEGrade(request.grade.upper())
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid grade value")

        # =========================
        # AUTO APPROVAL RULE
        # =========================
        auto_approve = role == "school_admin"

        # =========================
        # CREATE RESULT
        # =========================
        result = Result(
            school_id=school_id,
            exam_id=request.exam_id,
            student_id=request.student_id,
            subject=request.subject,
            marks=request.marks,
            grade=grade,
            teacher_comments=request.teacher_comments,

            approval_status=(
                ApprovalStatus.APPROVED
                if auto_approve
                else ApprovalStatus.PENDING
            ),

            submitted_by=current_user.get("user_id"),

            approved_by=(
                current_user.get("user_id")
                if auto_approve
                else None
            ),

            approval_date=(
                now_iso()
                if auto_approve
                else None
            ),
        )

        result_dict = ensure_id(
            serialize_doc(result.model_dump())
        )

        await db.results.insert_one(result_dict)

        return {
            "message": "Result recorded",
            "result_id": result_dict["id"],
            "approval_status": result_dict["approval_status"]
        }

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Result error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/results/{student_id}")
async def get_student_results(
    student_id: str,
    current_user: dict = Depends(get_current_user)
):

    try:

        school_id = current_user.get("school_id")

        if not school_id:
            raise HTTPException(status_code=403, detail="Unauthorized")

        # =========================
        # ROLE NORMALIZATION (FIXED)
        # =========================
        role = normalize_role(current_user.get("role"))

        query = {
            "school_id": school_id,
            "student_id": student_id
        }

        # Only admin + teacher can see unapproved results
        if role not in ["school_admin", "teacher", "super_admin"]:
            query["approval_status"] = "approved"

        results = await db.results.find(
            query,
            {"_id": 0}
        ).sort(
            "created_at",
            -1
        ).to_list(length=1000)

        return results

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Get results error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# =========================================================
# ANNOUNCEMENTS
# =========================================================

@api_router.get("/announcements")
async def get_announcements(
    approval_status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):

    try:

        school_id = current_user.get("school_id")

        if not school_id:
            raise HTTPException(status_code=403, detail="Unauthorized")

        role = normalize_role(current_user.get("role"))

        query = {
            "school_id": school_id
        }

        can_view_all = role in [
            "school_admin",
            "secretary",
            "teacher",
            "super_admin"
        ]

        if not can_view_all:
            query["approval_status"] = "approved"

        elif approval_status and approval_status != "all":
            query["approval_status"] = approval_status

        announcements = await db.announcements.find(
            query,
            {"_id": 0}
        ).sort(
            "created_at",
            -1
        ).to_list(length=1000)

        return announcements

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Get announcements error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# =========================================================
# ADMIN APPROVAL QUEUE (FIXED CONSISTENCY)
# =========================================================

@api_router.get("/admin/pending")
async def get_all_pending(current_user: dict = Depends(get_current_user)):

    try:

        school_id = current_user.get("school_id")

        if not school_id:
            raise HTTPException(status_code=403, detail="Unauthorized")

        role = normalize_role(current_user.get("role"))

        if role != "school_admin":
            raise HTTPException(status_code=403, detail="Admin access required")

        base_query = {
            "school_id": school_id,
            "approval_status": "pending"
        }

        pending_students = await db.students.find(base_query, {"_id": 0}).to_list(500)
        pending_results = await db.results.find(base_query, {"_id": 0}).to_list(500)
        pending_attendance = await db.attendance.find(base_query, {"_id": 0}).to_list(500)
        pending_payments = await db.payments.find(base_query, {"_id": 0}).to_list(500)
        pending_announcements = await db.announcements.find(base_query, {"_id": 0}).to_list(500)

        submitter_ids = set()

        for collection in [
            pending_students,
            pending_results,
            pending_attendance,
            pending_payments,
            pending_announcements
        ]:
            for item in collection:
                if item.get("submitted_by"):
                    submitter_ids.add(item["submitted_by"])

        users_map = {}

        if submitter_ids:
            users = await db.users.find(
                {
                    "id": {"$in": list(submitter_ids)},
                    "school_id": school_id
                },
                {"_id": 0, "password_hash": 0}
            ).to_list(1000)

            users_map = {u["id"]: u for u in users}

        def attach_users(items, item_type):
            for item in items:
                item["_type"] = item_type
                item["submitter"] = users_map.get(item.get("submitted_by"))

        attach_users(pending_students, "student")
        attach_users(pending_results, "result")
        attach_users(pending_attendance, "attendance")
        attach_users(pending_payments, "payment")
        attach_users(pending_announcements, "announcement")

        return {
            "students": pending_students,
            "results": pending_results,
            "attendance": pending_attendance,
            "payments": pending_payments,
            "announcements": pending_announcements,
            "total": (
                len(pending_students)
                + len(pending_results)
                + len(pending_attendance)
                + len(pending_payments)
                + len(pending_announcements)
            )
        }

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Get pending error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

# ─── LEGACY FINANCE APPROVAL REQUEST ─────────────────────────────

@api_router.post(
    "/finance/request-approval",
    operation_id="finance_request_admin_approval"
)
async def request_admin_approval(
    request: dict,
    current_user: dict = Depends(get_current_user)
):

    try:

        # =========================
        # SCHOOL VALIDATION
        # =========================
        school_id = current_user.get("school_id")

        if not school_id:
            raise HTTPException(
                status_code=403,
                detail="Unauthorized"
            )

        # =========================
        # ROLE VALIDATION
        # =========================
        role = normalize_role(current_user.get("role"))

        if role != "finance":
            raise HTTPException(
                status_code=403,
                detail="Only finance personnel can send requests"
            )

        # =========================
        # SAFE INPUT
        # =========================
        if not isinstance(request, dict):
            raise HTTPException(
                status_code=400,
                detail="Invalid request payload"
            )

        message = str(
            request.get("message") or ""
        ).strip()

        request_type = str(
            request.get("request_type") or "general"
        ).strip().lower()

        if not message:
            raise HTTPException(
                status_code=400,
                detail="Message cannot be empty"
            )

        # =========================
        # CREATE REQUEST
        # =========================
        approval_request = {
            "id": str(uuid.uuid4()),
            "school_id": school_id,
            "submitted_by": (
                current_user.get("id")
                or current_user.get("user_id")
            ),
            "requested_by": (
                current_user.get("id")
                or current_user.get("user_id")
            ),
            "message": message,
            "request_type": request_type,
            "status": "pending",
            "created_at": now_iso(),
            "updated_at": now_iso()
        }

        await db.approval_requests.insert_one(
            approval_request
        )

        # =========================
        # RESPONSE
        # =========================
        return {
            "success": True,
            "message": "Request sent to admin",
            "request_id": approval_request["id"],
            "status": "pending"
        }

    except HTTPException:
        raise

    except Exception as e:
        logger.error(
            f"Approval request error: {str(e)}"
        )

        raise HTTPException(
            status_code=500,
            detail="Internal server error"
        )

@api_router.get("/admin/approval-requests")
async def get_approval_requests(
    current_user: dict = Depends(get_current_user)
):
    try:

        # =========================
        # SCHOOL VALIDATION
        # =========================
        school_id = current_user.get("school_id")

        if not school_id:
            raise HTTPException(status_code=403, detail="Unauthorized")

        # FIX: normalize role consistently
        role = normalize_role(current_user.get("role"))

        if role != "school_admin":
            raise HTTPException(status_code=403, detail="Admin access required")

        # =========================
        # FETCH REQUESTS
        # =========================
        requests = await db.approval_requests.find(
            {"school_id": school_id},
            {"_id": 0}
        ).sort("created_at", -1).to_list(length=100)

        return {
            "success": True,
            "data": requests
        }

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Get approval requests error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


# ─── Dashboard Stats ─────────────────────────────────────────────

@api_router.put("/students/{student_id}")
async def update_student(
    student_id: str,
    update_data: dict,
    current_user: dict = Depends(get_current_user)
):
    try:

        # =========================
        # ROLE VALIDATION (FIXED)
        # =========================
        role = normalize_role(current_user.get("role"))

        if role not in ["school_admin", "secretary"]:
            raise HTTPException(status_code=403, detail="Unauthorized")

        # =========================
        # SCHOOL VALIDATION
        # =========================
        school_id = current_user.get("school_id")

        if not school_id:
            raise HTTPException(status_code=403, detail="No school assigned")

        # =========================
        # INPUT SAFETY
        # =========================
        if not isinstance(update_data, dict):
            raise HTTPException(status_code=400, detail="Invalid update payload")

        # =========================
        # FETCH STUDENT FIRST (SECURITY FIX)
        # =========================
        existing_student = await db.students.find_one({
            "id": student_id,
            "school_id": school_id
        })

        if not existing_student:
            raise HTTPException(status_code=404, detail="Student not found")

        # =========================
        # ALLOWED FIELDS ONLY
        # =========================
        allowed_fields = {
            "full_name",
            "date_of_birth",
            "gender",
            "class_name",
            "year_of_study",
            "stream",
            "guardian_name",
            "guardian_phone",
            "guardian_email",
            "guardian_relationship",
            "secondary_guardian_name",
            "secondary_guardian_phone",
            "secondary_guardian_email",
            "secondary_guardian_relationship",
            "blood_type",
            "allergies",
            "chronic_conditions",
            "disabilities",
            "immunization_status",
            "medical_info",
            "status"
        }

        clean_update = {
            k: v for k, v in update_data.items()
            if k in allowed_fields and v is not None
        }

        if not clean_update:
            raise HTTPException(
                status_code=400,
                detail="No valid fields provided for update"
            )

        # =========================
        # DATE HANDLING FIX
        # =========================
        if "date_of_birth" in clean_update:
            try:
                dob = clean_update["date_of_birth"]

                if isinstance(dob, str):
                    clean_update["date_of_birth"] = datetime.fromisoformat(dob)
                elif isinstance(dob, datetime):
                    clean_update["date_of_birth"] = dob
                else:
                    raise ValueError()

            except Exception:
                raise HTTPException(
                    status_code=400,
                    detail="Invalid date_of_birth format"
                )

        # =========================
        # SECRETARY RULE (RE-APPROVAL SAFETY)
        # =========================
        if role == "secretary":
            clean_update["approval_status"] = "pending"
            clean_update["approved_by"] = None
            clean_update["approval_date"] = None

        # =========================
        # TIMESTAMP
        # =========================
        clean_update["updated_at"] = now_iso()

        # =========================
        # UPDATE DB
        # =========================
        await db.students.update_one(
            {
                "id": student_id,
                "school_id": school_id
            },
            {"$set": clean_update}
        )

        # =========================
        # RETURN UPDATED STUDENT
        # =========================
        updated_student = await db.students.find_one(
            {
                "id": student_id,
                "school_id": school_id
            },
            {"_id": 0}
        )

        return {
            "success": True,
            "message": "Student updated successfully",
            "student": updated_student
        }

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Update student error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error"
        )

# ─────────────────────────────────────────────
# M-PESA CALLBACK (SAFE + PRODUCTION READY)
# ─────────────────────────────────────────────

from fastapi import Request

@api_router.post("/webhooks/mpesa/callback")
async def mpesa_callback(request: Request):
    callback = await request.json()

    if not isinstance(callback, dict):
        return {"ResultCode": 0, "ResultDesc": "Success"}

    body = callback.get("Body", {})
    stk = body.get("stkCallback", {})

    merchant_request_id = stk.get("MerchantRequestID")
    checkout_request_id = stk.get("CheckoutRequestID")
    result_code = stk.get("ResultCode")

    existing = await db.mpesa_callbacks.find_one({
        "checkout_request_id": checkout_request_id
    })

    if not existing:
        await db.mpesa_callbacks.insert_one({
            "merchant_request_id": merchant_request_id,
            "checkout_request_id": checkout_request_id,
            "result_code": result_code,
            "raw": callback,
            "created_at": now_iso()
        })

    return {"ResultCode": 0, "ResultDesc": "Success"}

# ─────────────────────────────────────────────
# STUDENT PORTAL DATA (FULL FIXED FLOW)
# ─────────────────────────────────────────────

@api_router.get("/portal/my-data")
async def get_my_portal_data(current_user: dict = Depends(get_current_user)):
    try:

        school_id = current_user.get("school_id")
        user_id = current_user.get("user_id")
        email = current_user.get("email")

        if not school_id:
            raise HTTPException(status_code=403, detail="No school assigned")

        # =========================
        # STUDENT LINKING (SAFE + CONSISTENT)
        # =========================
        student = await db.students.find_one(
            {
                "school_id": school_id,
                "submitted_by": user_id,
                "approval_status": "approved"
            },
            {"_id": 0}
        )

        if not student and email:
            student = await db.students.find_one(
                {
                    "school_id": school_id,
                    "guardian_email": email,
                    "approval_status": "approved"
                },
                {"_id": 0}
            )

        if not student:
            return {
                "student": None,
                "results": [],
                "attendance": [],
                "payments": [],
                "announcements": [],
                "fee_balance": 0
            }

        student_id = student["id"]

        # =========================
        # RESULTS (APPROVED ONLY)
        # =========================
        results = await db.results.find(
            {
                "school_id": school_id,
                "student_id": student_id,
                "approval_status": "approved"
            },
            {"_id": 0}
        ).to_list(500)

        exam_ids = [r.get("exam_id") for r in results if r.get("exam_id")]

        exams = await db.exams.find(
            {
                "id": {"$in": exam_ids},
                "school_id": school_id
            },
            {"_id": 0}
        ).to_list(500)

        exam_map = {e["id"]: e for e in exams}

        for r in results:
            exam = exam_map.get(r.get("exam_id"))
            if exam:
                r["exam_name"] = exam.get("name")
                r["term"] = exam.get("term")
                r["academic_year"] = exam.get("academic_year")

        # =========================
        # ATTENDANCE (SAFE FALLBACK)
        # =========================
        attendance_records = await db.attendance.find(
            {
                "school_id": school_id,
                "student_id": student_id,
                "approval_status": "approved"
            },
            {"_id": 0}
        ).to_list(500)

        if not attendance_records:
            attendance_records = await db.attendance.find(
                {
                    "school_id": school_id,
                    "entity_id": student_id,
                    "entity_type": "student",
                    "approval_status": "approved"
                },
                {"_id": 0}
            ).to_list(500)

        # =========================
        # PAYMENTS (SAFE SUM)
        # =========================
        payments = await db.payments.find(
            {
                "school_id": school_id,
                "student_id": student_id,
                "approval_status": "approved"
            },
            {"_id": 0}
        ).sort("created_at", -1).to_list(500)

        total_paid = sum(
            float(p.get("amount") or 0)
            for p in payments
            if p.get("status") in ["completed", "approved", "paid"]
        )

        # =========================
        # FEES (SAFE)
        # =========================
        fee_structures = await db.fee_structures.find(
            {
                "school_id": school_id,
                "class_name": student.get("class_name")
            },
            {"_id": 0}
        ).to_list(50)

        total_fees = sum(float(f.get("amount") or 0) for f in fee_structures)

        fee_balance = total_fees - total_paid

        # =========================
        # ANNOUNCEMENTS
        # =========================
        announcements = await db.announcements.find(
            {
                "school_id": school_id,
                "approval_status": "approved"
            },
            {"_id": 0}
        ).sort("created_at", -1).to_list(100)

        return {
            "student": student,
            "results": results,
            "attendance": attendance_records,
            "payments": payments,
            "announcements": announcements,
            "fee_balance": fee_balance
        }

    except Exception as e:
        logger.error(f"Portal data error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


# ─────────────────────────────────────────────
# FINANCE TRANSACTIONS (FIXED + CONSISTENT)
# ─────────────────────────────────────────────

@api_router.post("/finance/transactions")
async def create_transaction(
    request: CreateTransactionRequest,
    current_user: dict = Depends(get_current_user)
):
    try:

        school_id = current_user.get("school_id")
        if not school_id:
            raise HTTPException(status_code=403, detail="No school assigned")

        # =========================
        # ROLE NORMALIZATION
        # =========================
        role = normalize_role(current_user.get("role"))

        allowed_roles = ["school_admin", "finance"]

        if role not in allowed_roles:
            raise HTTPException(status_code=403, detail="Unauthorized")

        # =========================
        # SAFE DATE HANDLING
        # =========================
        txn_date = None

        if request.date:
            try:
                txn_date = (
                    datetime.fromisoformat(request.date)
                    if isinstance(request.date, str)
                    else request.date
                )
            except Exception:
                raise HTTPException(
                    status_code=400,
                    detail="Invalid date format (ISO required)"
                )

        # =========================
        # APPROVAL LOGIC
        # =========================
        auto_approve = role == "school_admin"

        txn = {
            "id": str(uuid.uuid4()),
            "school_id": school_id,
            "transaction_type": request.transaction_type,
            "category": request.category,
            "amount": request.amount,
            "description": request.description,
            "date": txn_date or now_iso(),

            "approval_status": "approved" if auto_approve else "pending",
            "submitted_by": current_user.get("user_id"),
            "approved_by": current_user.get("user_id") if auto_approve else None,
            "approval_date": now_iso() if auto_approve else None,

            "created_at": now_iso(),
            "updated_at": now_iso()
        }

        await db.finance_transactions.insert_one(txn)

        return {
            "success": True,
            "message": "Transaction recorded",
            "id": txn["id"],
            "approval_status": txn["approval_status"]
        }

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Transaction error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

# ─────────────────────────────────────────────
# FINANCE: GET TRANSACTIONS (FIXED)
# ─────────────────────────────────────────────

@api_router.get("/finance/transactions")
async def get_transactions(current_user: dict = Depends(get_current_user)):
    try:

        school_id = current_user.get("school_id")
        if not school_id:
            raise HTTPException(status_code=403, detail="No school assigned")

        # =========================
        # ROLE NORMALIZATION (FIXED)
        # =========================
        role = normalize_role(current_user.get("role"))

        allowed_roles = ["school_admin", "finance"]

        if role not in allowed_roles:
            raise HTTPException(status_code=403, detail="Unauthorized")

        # =========================
        # QUERY BUILD
        # =========================
        query = {"school_id": school_id}

        # Finance users only see approved data
        if role != "school_admin":
            query["approval_status"] = "approved"

        txns = await db.finance_transactions.find(
            query,
            {"_id": 0}
        ).sort("created_at", -1).to_list(length=1000)

        return txns

    except Exception as e:
        logger.error(f"Get transactions error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

# ─────────────────────────────────────────────
# FINANCE: SUMMARY (FIXED + STABLE)
# ─────────────────────────────────────────────

@api_router.get("/finance/summary")
async def get_finance_summary(current_user: dict = Depends(get_current_user)):
    try:

        school_id = current_user.get("school_id")
        if not school_id:
            raise HTTPException(status_code=403, detail="No school assigned")

        # =========================
        # ROLE NORMALIZATION (FIXED)
        # =========================
        role = normalize_role(current_user.get("role"))

        allowed_roles = ["school_admin", "finance"]

        if role not in allowed_roles:
            raise HTTPException(status_code=403, detail="Unauthorized")

        # =========================
        # APPROVED PAYMENTS ONLY
        # =========================
        payments = await db.payments.find(
            {
                "school_id": school_id,
                "approval_status": "approved",
                "status": "completed"
            },
            {"_id": 0}
        ).to_list(length=5000)

        total_fee_income = sum(
            float(p.get("amount") or 0)
            for p in payments
        )

        # =========================
        # FINANCE TRANSACTIONS
        # =========================
        txns = await db.finance_transactions.find(
            {
                "school_id": school_id,
                "approval_status": "approved"
            },
            {"_id": 0}
        ).to_list(length=5000)

        total_other_income = sum(
            float(t.get("amount") or 0)
            for t in txns
            if t.get("transaction_type") == "income"
        )

        total_expenditure = sum(
            float(t.get("amount") or 0)
            for t in txns
            if t.get("transaction_type") == "expenditure"
        )

        total_income = total_fee_income + total_other_income
        running_balance = total_income - total_expenditure

        return {
            "success": True,
            "total_fee_income": total_fee_income,
            "total_other_income": total_other_income,
            "total_income": total_income,
            "total_expenditure": total_expenditure,
            "running_balance": running_balance,
            "transaction_count": len(txns),
            "payment_count": len(payments)
        }

    except Exception as e:
        logger.error(f"Finance summary error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

# ─────────────────────────────────────────────
# STUDENT PROGRESSION (UNCHANGED SAFE CONSTANT)
# ─────────────────────────────────────────────

GRADE_ORDER = [
    "PP1", "PP2", "Grade 1", "Grade 2", "Grade 3", "Grade 4",
    "Grade 5", "Grade 6", "Grade 7", "Grade 8", "Grade 9",
    "Grade 10", "Grade 11", "Grade 12"
]

# ─── Student Progression System ───────────────────────────────────

@api_router.post("/admin/progress-students")
async def progress_students(
    request: ProgressStudentsRequest,
    current_user: dict = Depends(get_current_user)
):
    try:
        school_id = current_user.get("school_id")

        if not school_id:
            raise HTTPException(status_code=403, detail="No school assigned")

        # =========================
        # ROLE SAFETY FIX (IMPORTANT)
        # =========================
        role = (current_user.get("role") or "").upper()

        if role != "SCHOOL_ADMIN":
            raise HTTPException(status_code=403, detail="Admin access required")

        query = {
            "school_id": school_id,
            "approval_status": "approved",
            "status": "active"
        }

        if request.from_class:
            query["class_name"] = request.from_class

        students = await db.students.find(
            query,
            {"_id": 0}
        ).to_list(length=5000)

        progressed = 0
        graduated = 0
        archived = []

        for student in students:

            current_class = student.get("class_name")

            if not current_class or current_class not in GRADE_ORDER:
                continue

            idx = GRADE_ORDER.index(current_class)

            await db.student_history.insert_one({
                "id": str(uuid.uuid4()),
                "student_id": student["id"],
                "school_id": school_id,
                "academic_year": request.academic_year,
                "class_name": current_class,
                "stream": student.get("stream"),
                "created_at": now_iso()
            })

            if idx == len(GRADE_ORDER) - 1:

                await db.students.update_one(
                    {"id": student["id"], "school_id": school_id},
                    {"$set": {
                        "status": "graduated",
                        "status_changed_at": now_iso(),
                        "status_reason": f"Completed {current_class}",
                        "updated_at": now_iso()
                    }}
                )

                graduated += 1

            else:

                next_class = GRADE_ORDER[idx + 1]

                await db.students.update_one(
                    {"id": student["id"], "school_id": school_id},
                    {"$set": {
                        "class_name": next_class,
                        "status": "active",
                        "updated_at": now_iso()
                    }}
                )

                progressed += 1

                archived.append({
                    "name": student.get("full_name"),
                    "from": current_class,
                    "to": next_class
                })

        return {
            "message": f"Progression complete for {request.academic_year}",
            "progressed": progressed,
            "graduated": graduated,
            "total_processed": progressed + graduated,
            "details": archived[:20]
        }

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Progression error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

# ─── Student History ──────────────────────────────────────────────

@api_router.get("/students/{student_id}/history")
async def get_student_history(
    student_id: str,
    current_user: dict = Depends(get_current_user)
):
    try:
        school_id = current_user.get("school_id")

        if not school_id:
            raise HTTPException(status_code=403, detail="No school assigned")

        # =========================
        # ROLE SAFETY (ADDED FIX)
        # =========================
        role = (current_user.get("role") or "").upper()

        allowed_roles = [
            "SCHOOL_ADMIN",
            "TEACHER",
            "SECRETARY"
        ]

        if role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail="Unauthorized"
            )

        # =========================
        # SECURITY CHECK
        # =========================
        student = await db.students.find_one(
            {
                "id": student_id,
                "school_id": school_id
            },
            {"_id": 0}
        )

        if not student:
            raise HTTPException(status_code=404, detail="Student not found")

        history = await db.student_history.find(
            {
                "student_id": student_id,
                "school_id": school_id
            },
            {"_id": 0}
        ).sort("created_at", -1).to_list(length=100)

        return history

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"History error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error"
        )


# ─── App Setup ────────────────────────────────────────────────────

app.include_router(api_router)


# =========================
# FIX: MODERN FASTAPI SHUTDOWN HANDLER
# =========================
@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()