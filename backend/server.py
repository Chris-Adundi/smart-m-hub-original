from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Request, UploadFile, File, Form
from fastapi.security import HTTPBearer
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError
from bson import ObjectId

import os
import logging
import uuid
import re
import secrets
import string

from pathlib import Path
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime, timezone, timedelta

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
    login_user,
    normalize_role as canonical_normalize_role,
    validate_password_strength,
    assert_login_not_locked,
    record_login_failure,
    clear_login_failures,
    log_security_event,
)

# =====================================================
# ROOT + ENV
# =====================================================
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# =====================================================
# DATABASE CONNECTION
# =====================================================
APP_ENV = os.getenv("APP_ENV", os.getenv("ENV", "development")).lower()
mongo_url = os.getenv("MONGO_URL")
if not mongo_url:
    if APP_ENV in {"production", "prod"}:
        raise RuntimeError("MONGO_URL must be set in production")
    mongo_url = "mongodb://localhost:27017"
db_name = os.getenv("DB_NAME", "smart_m_hub")

if not isinstance(db_name, str) or not db_name.strip():
    raise ValueError("DB_NAME must be a valid string. Check your .env file.")

client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

# =====================================================
# FASTAPI APP SETUP
# =====================================================
app = FastAPI()

UPLOAD_ROOT = ROOT_DIR / "uploads"
UPLOAD_ROOT.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_ROOT)), name="uploads")

def parse_allowed_origin_regex():
    configured = os.getenv("ALLOWED_ORIGIN_REGEX") or os.getenv("CORS_ORIGIN_REGEX")
    if configured:
        return configured
    if str(os.getenv("ALLOW_CLOUDFLARE_TUNNEL", "")).lower() in {"1", "true", "yes"}:
        return r"https://.*\.trycloudflare\.com"
    return None


def parse_allowed_origins(allowed_origin_regex: Optional[str] = None):
    configured = os.getenv("ALLOWED_ORIGINS") or os.getenv("CORS_ORIGINS")
    if configured:
        return [origin.strip().rstrip("/") for origin in configured.split(",") if origin.strip()]
    if APP_ENV in {"production", "prod"}:
        if allowed_origin_regex:
            return []
        raise RuntimeError("ALLOWED_ORIGINS or CORS_ORIGINS must be set in production")
    return [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ]


allowed_origin_regex = parse_allowed_origin_regex()

app.add_middleware(
    CORSMiddleware,
    allow_origins=parse_allowed_origins(allowed_origin_regex),
    allow_origin_regex=allowed_origin_regex,
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
    "suspended",
    "deactivated"
]

VALID_SYSTEM_ROLES = [
    "super_admin",
    "school_admin",
    "teacher",
    "finance",
    "secretary",
    "student",
    "parent",
    "supporting_staff"
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


def api_success(data=None, message: Optional[str] = None, **extra) -> dict:
    response = {
        "success": True,
        "data": data
    }

    if message:
        response["message"] = message

    response.update(extra)
    return response


def ensure_id(doc: dict) -> dict:

    if doc and not doc.get("id"):
        doc["id"] = generate_uuid()

    return doc


# =====================================================
# ROLE NORMALIZATION
# =====================================================
def normalize_role(role: str) -> str:
    return canonical_normalize_role(role)


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


def resource_lookup(resource_id: str) -> dict:
    lookup = [{"id": resource_id}]
    if ObjectId.is_valid(str(resource_id)):
        lookup.append({"_id": ObjectId(str(resource_id))})
    return {"$or": lookup}


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


async def generate_school_code() -> str:
    """
    Allocate a non-guessable public school code.

    Legacy sequential codes remain supported by lookup endpoints, but new
    registrations must not reveal school volume or registration order.
    """
    alphabet = string.ascii_uppercase + string.digits
    for _ in range(25):
        code_body = "".join(secrets.choice(alphabet) for _ in range(10))
        school_code = f"SMH-{code_body}"

        if not await db.schools.find_one(
            {"school_code": school_code},
            {"_id": 1}
        ):
            return school_code
    raise HTTPException(status_code=500, detail="Unable to generate unique school code")


def generate_invite_code() -> str:
    return str(uuid.uuid4()).split("-")[1].upper()


def generate_temporary_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


async def generate_admission_number(school_id: str) -> str:
    counter = await db.counters.find_one_and_update(
        {"_id": f"admission_number:{school_id}"},
        {"$inc": {"sequence": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER
    )
    return f"ADM-{int(counter['sequence']):05d}"


async def generate_student_access_code(school_id: str) -> str:
    alphabet = string.ascii_uppercase + string.digits
    for _ in range(10):
        code = "STU-" + "".join(secrets.choice(alphabet) for _ in range(8))
        existing = await db.students.find_one(
            {"school_id": school_id, "student_access_code": code},
            {"_id": 1}
        )
        if not existing:
            return code
    raise HTTPException(status_code=500, detail="Unable to generate unique student access code")


def generate_verification_code() -> str:
    return "".join(secrets.choice(string.digits) for _ in range(6))


def normalize_fee_status(value: str) -> str:
    normalized = str(value or "").strip().lower().replace(" ", "_")
    if normalized not in {"cleared", "warning", "send_home"}:
        raise HTTPException(status_code=400, detail="Fee status must be cleared, warning, or send_home")
    return normalized


STAFF_JOIN_ROLES = {"teacher", "secretary", "finance", "supporting_staff"}


def role_label(role: str) -> str:
    labels = {
        "teacher": "Teacher",
        "secretary": "Secretary",
        "finance": "Finance Officer",
        "supporting_staff": "Supporting Staff",
        "parent": "Parent/Guardian",
    }
    return labels.get(normalize_role(role), str(role or "").replace("_", " ").title())


def classify_school_level(class_name: Optional[str]) -> Optional[str]:
    value = str(class_name or "").strip().lower().replace(" ", "")
    if value in {"pp1", "pp2", "preprimary1", "preprimary2"}:
        return "Primary"

    match = re.search(r"(\d+)", value)
    if not match:
        return None

    grade = int(match.group(1))
    if 1 <= grade <= 6:
        return "Primary"
    if 7 <= grade <= 9:
        return "Junior Secondary"
    if 10 <= grade <= 12:
        return "Senior Secondary"
    return None


def receipt_breakdown(payment: dict):
    default_items = [
        "Tuition",
        "Admission Fee",
        "Activity Fee",
        "Examination Fee",
        "Transport",
        "Boarding",
        "Meals",
        "Uniform",
        "Other",
    ]
    existing = payment.get("payment_breakdown") or []
    if existing:
        return existing
    payment_type = str(payment.get("payment_type") or "Other").replace("_", " ").title()
    return [
        {
            "item": item,
            "term": payment.get("term") or "",
            "amount": payment.get("amount") if item == payment_type or (payment_type == "Fees" and item == "Tuition") else 0,
            "remarks": payment.get("description") if item == "Other" else "",
        }
        for item in default_items
    ]


def get_frontend_url() -> str:
    configured = os.getenv("FRONTEND_URL")
    if configured:
        return configured.rstrip("/")
    if APP_ENV in {"production", "prod"}:
        raise RuntimeError("FRONTEND_URL must be set in production")
    return "http://localhost:3000"


async def ensure_school_identity(school: dict) -> dict:
    """Backfill identity fields for schools created by older versions."""
    if not school:
        return school

    updates = {}
    school_code = school.get("school_code")

    if not school_code:
        school_code = await generate_school_code()
        updates["school_code"] = school_code

    slug = school.get("slug") or school.get("school_slug")
    if not slug:
        slug = generate_school_slug(school.get("name") or "school")
        updates["slug"] = slug

    login_link = f"{get_frontend_url()}/login?school={school_code}"
    if school.get("login_link") != login_link:
        updates["login_link"] = login_link

    if updates:
        updates["updated_at"] = now_utc()
        await db.schools.update_one(
            {"_id": school["_id"]},
            {"$set": updates}
        )
        school.update(updates)

    return school


async def find_school_for_join(school_code: Optional[str] = None, invite_code: Optional[str] = None) -> Optional[dict]:
    normalized_code = str(school_code or "").strip().upper()
    raw_invite = str(invite_code or "").strip()
    normalized_invite = raw_invite.upper()

    if normalized_code:
        return await db.schools.find_one({"school_code": normalized_code})

    if not raw_invite:
        return None

    return await db.schools.find_one({
        "$or": [
            {"invite_code": normalized_invite},
            {"join_slug": raw_invite},
            {"join_slug": raw_invite.lower()},
            {"slug": raw_invite},
            {"slug": raw_invite.lower()},
        ]
    })


def school_branding_payload(school: dict) -> dict:
    theme = school.get("theme") or {}
    return {
        "id": school.get("id"),
        "name": school.get("name"),
        "school_code": school.get("school_code"),
        "login_link": school.get("login_link"),
        "operation_type": school.get("operation_type", "day"),
        "boarding_enabled": bool(school.get("boarding_enabled", False)),
        "logo_url": school.get("logo_url") or school.get("logo"),
        "banner_url": school.get("banner_url"),
        "motto": school.get("motto"),
        "mission": school.get("mission"),
        "vision": school.get("vision"),
        "theme": {
            "primary": theme.get("primary") or "#10B981",
            "secondary": theme.get("secondary") or "#0F172A"
        }
    }


async def get_school_class_names(school_id: str) -> List[str]:
    class_names = set()

    sources = [
        (db.timetable, "class_name"),
        (db.fee_structures, "class_name"),
        (db.students, "class_name"),
        (db.exams, "class_name"),
    ]

    for collection, field_name in sources:
        values = await collection.distinct(field_name, {"school_id": school_id})
        for value in values:
            class_name = str(value or "").strip()
            if class_name:
                class_names.add(class_name)

    return sorted(class_names, key=lambda value: value.lower())


ALLOWED_UPLOAD_CATEGORIES = {
    "school_logo",
    "school_stamp",
    "student_photo",
    "medical_letter",
    "receipt",
    "exam",
    "assessment",
    "inventory",
    "document",
}
ALLOWED_UPLOAD_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "application/pdf": ".pdf",
}
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_MB", "5")) * 1024 * 1024


def validate_upload_category(category: str) -> str:
    normalized = str(category or "document").strip().lower().replace(" ", "_")
    if normalized not in ALLOWED_UPLOAD_CATEGORIES:
        raise HTTPException(status_code=400, detail="Invalid upload category")
    return normalized


def validate_upload_file(file: UploadFile) -> str:
    content_type = str(file.content_type or "").lower()
    extension = ALLOWED_UPLOAD_TYPES.get(content_type)
    if not extension:
        raise HTTPException(status_code=400, detail="Unsupported file type")

    original_suffix = Path(file.filename or "").suffix.lower()
    if original_suffix and original_suffix not in set(ALLOWED_UPLOAD_TYPES.values()):
        raise HTTPException(status_code=400, detail="Invalid file extension")

    return extension


# =====================================================
# REQUEST MODELS
# =====================================================
class RegisterSchoolRequest(BaseModel):

    name: str
    address: str
    phone: str
    email: EmailStr
    school_type: str
    school_classification: Optional[str] = None
    operation_type: str = "day"

    logo_url: Optional[str] = None
    banner_url: Optional[str] = None
    stamp_url: Optional[str] = None
    motto: Optional[str] = None
    vision: Optional[str] = None
    mission: Optional[str] = None
    principal_name: Optional[str] = None
    principal_email: Optional[EmailStr] = None
    principal_phone: Optional[str] = None
    website: Optional[str] = None
    established_year: Optional[str] = None
    school_registration_number: Optional[str] = None
    ministry_registration_number: Optional[str] = None
    kra_pin: Optional[str] = None
    theme_primary: Optional[str] = None
    theme_secondary: Optional[str] = None

    admin_name: str
    admin_email: EmailStr
    admin_phone: Optional[str] = None
    admin_password: Optional[str] = None
    curriculum: Optional[str] = "CBC"
    ownership: Optional[str] = None
    alternative_phone: Optional[str] = None
    country: Optional[str] = None
    county: Optional[str] = None
    sub_county: Optional[str] = None
    town: Optional[str] = None
    postal_address: Optional[str] = None
    admin_national_id: Optional[str] = None
    admin_role: Optional[str] = "School Administrator"
    declarations_confirmed: Optional[bool] = False


class RegistrationPaymentPhoneRequest(BaseModel):
    school_id: str
    school_code: str
    payment_phone: str


class JoinSchoolRequest(BaseModel):

    invite_code: str
    role: str

    email: EmailStr
    password: str

    full_name: Optional[str] = None
    phone: Optional[str] = None
    school_code: Optional[str] = None
    selected_classes: Optional[List[str]] = None
    child_name: Optional[str] = None
    child_admission_number: Optional[str] = None
    admission_number: Optional[str] = None
    student_access_code: Optional[str] = None


class LoginRequest(BaseModel):

    email: EmailStr
    password: str
    school_code: Optional[str] = None
    admission_number: Optional[str] = None
    student_access_code: Optional[str] = None


class CreateStudentRequest(BaseModel):

    admission_number: Optional[str] = None
    passport_photo_url: Optional[str] = None
    full_name: str
    date_of_birth: Optional[str] = None

    gender: Optional[str] = None
    birth_certificate_no: Optional[str] = None
    nationality: Optional[str] = None
    religion: Optional[str] = None
    special_needs: Optional[str] = None

    class_name: Optional[str] = None
    year_of_study: Optional[str] = None
    stream: Optional[str] = None

    guardian_name: Optional[str] = None
    guardian_phone: Optional[str] = None

    guardian_email: Optional[EmailStr] = None
    guardian_relationship: Optional[str] = None
    guardian_occupation: Optional[str] = None
    guardian_national_id: Optional[str] = None
    guardian_address: Optional[str] = None

    secondary_guardian_name: Optional[str] = None
    secondary_guardian_phone: Optional[str] = None
    secondary_guardian_email: Optional[EmailStr] = None
    secondary_guardian_relationship: Optional[str] = None
    secondary_guardian_occupation: Optional[str] = None
    secondary_guardian_national_id: Optional[str] = None
    secondary_guardian_address: Optional[str] = None

    blood_type: Optional[str] = None
    allergies: Optional[str] = None
    chronic_conditions: Optional[str] = None
    disabilities: Optional[str] = None
    immunization_status: Optional[str] = None
    medical_info: Optional[str] = None
    medication: Optional[str] = None
    hospital_letter_url: Optional[str] = None
    previous_school: Optional[str] = None
    transfer_reason: Optional[str] = None
    last_class: Optional[str] = None
    documents_attached: Optional[List[str]] = None

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
    term: Optional[str] = None
    academic_year: Optional[str] = None
    received_from: Optional[str] = None
    transaction_reference: Optional[str] = None
    payment_breakdown: Optional[List[dict]] = None
    total_amount_due: Optional[float] = None
    outstanding_balance: Optional[float] = None

    bank_reference: Optional[str] = None
    cheque_number: Optional[str] = None

    description: Optional[str] = None
    receipt_url: Optional[str] = None


class MarkAttendanceRequest(BaseModel):

    entity_type: str
    entity_id: str

    date: str

    status: AttendanceStatus

    remarks: Optional[str] = None
    class_name: Optional[str] = None


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

    target_audience: str = "all"

    target_class: Optional[str] = None
    target_student_ids: Optional[List[str]] = None
    target_staff_user_ids: Optional[List[str]] = None

    priority: str = "normal"


class RecordResultRequest(BaseModel):

    exam_id: str
    student_id: str

    subject: str

    marks: float
    grade: str

    teacher_comments: Optional[str] = None
    report_url: Optional[str] = None
    result_type: Optional[str] = "exam"
    term: Optional[str] = None


class ForgotPasswordRequest(BaseModel):
    email: EmailStr
    school_code: Optional[str] = None


class VerifyResetCodeRequest(BaseModel):
    email: EmailStr
    code: str
    new_password: str
    school_code: Optional[str] = None


class FeeStatusRequest(BaseModel):
    student_id: str
    status: str
    note: Optional[str] = None


class SupportNoticeRequest(BaseModel):
    school_id: str
    title: str
    message: str
    notice_type: Optional[str] = "support"
    severity: Optional[str] = "info"


class DiagnosticStatusRequest(BaseModel):
    status: str
    fix_notes: Optional[str] = None


class ApprovalActionRequest(BaseModel):

    action: str
    reason: Optional[str] = None


class CreateTransactionRequest(BaseModel):

    transaction_type: str
    category: str

    amount: float
    description: str

    date: Optional[str] = None


class CreateFeeStructureRequest(BaseModel):

    class_name: str
    term: Optional[str] = None
    academic_year: Optional[str] = None
    amount: float
    description: Optional[str] = None
    document_url: Optional[str] = None


class CreateTimetableRequest(BaseModel):

    class_name: str
    day: str
    subject: str
    time: str
    teacher_name: Optional[str] = None
    room: Optional[str] = None
    document_url: Optional[str] = None


class CreateInventoryItemRequest(BaseModel):

    name: str
    quantity: int = 0
    category: Optional[str] = None
    location: Optional[str] = None
    condition: Optional[str] = None
    reorder_level: Optional[int] = 0
    notes: Optional[str] = None


class ProgressStudentsRequest(BaseModel):

    academic_year: str
    from_class: Optional[str] = None


class CreateStaffPayload(BaseModel):

    full_name: str
    email: EmailStr
    phone: Optional[str] = None
    employee_number: str
    department: str
    position: str
    role: str = "teacher"
    password: str
    salary: Optional[float] = None
    joined_date: Optional[str] = None


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

    school = await ensure_school_identity(school)

    invite_code = school.get("invite_code")
    school_code = school.get("school_code")

    frontend_url = get_frontend_url()
    invite_link = school.get("invite_link") or f"{frontend_url}/join/{school.get('join_slug') or invite_code}"
    login_link = school.get("login_link") or f"{frontend_url}/login?school={school_code}"

    students_count = await db.students.count_documents({"school_id": school_id})
    teachers_count = await db.users.count_documents({"school_id": school_id, "role": "teacher"})
    staff_count = await db.users.count_documents({
        "school_id": school_id,
        "role": {"$in": ["teacher", "finance", "secretary"]}
    })
    admin_user = None
    if normalize_role(current_user.get("role")) == "school_admin":
        admin_user = await db.users.find_one(
            {
                "school_id": school_id,
                "role": "school_admin",
                "id": current_user.get("user_id")
            },
            {"_id": 0, "username": 1, "temporary_password": 1, "email": 1}
        )

    return {
        "success": True,
        "data": {
            "id": school.get("id"),
            "name": school.get("name"),
            "slug": school.get("slug"),
            "school_code": school_code,
            "email": school.get("email"),
            "phone": school.get("phone"),
            "address": school.get("address"),
            "school_type": school.get("school_type"),
            "school_classification": school.get("school_classification"),
            "operation_type": school.get("operation_type", "day"),
            "boarding_enabled": bool(school.get("boarding_enabled", False)),
            "invite_code": invite_code,
            "invite_link": invite_link,
            "login_link": login_link,
            "logo": school.get("logo") or school.get("logo_url"),
            "logo_url": school.get("logo_url"),
            "banner_url": school.get("banner_url"),
            "stamp_url": school.get("stamp_url"),
            "motto": school.get("motto"),
            "vision": school.get("vision"),
            "mission": school.get("mission"),
            "principal_name": school.get("principal_name"),
            "principal_email": school.get("principal_email"),
            "principal_phone": school.get("principal_phone"),
            "website": school.get("website"),
            "established_year": school.get("established_year"),
            "school_registration_number": school.get("school_registration_number"),
            "ministry_registration_number": school.get("ministry_registration_number"),
            "kra_pin": school.get("kra_pin"),
            "theme": school.get("theme") or {},
            "subscription_status": school.get("subscription_status"),
            "subscription_expiry": school.get("subscription_expiry"),
            "status": school.get("status"),
            "date_registered": school.get("created_at"),
            "counts": {
                "students": students_count,
                "teachers": teachers_count,
                "staff": staff_count
            },
            "generated_credentials": {
                "username": (admin_user or {}).get("username") or school.get("name"),
                "temporary_password": (admin_user or {}).get("temporary_password"),
                "login_link": login_link
            } if admin_user else None
        }
    }


@api_router.post("/uploads")
async def upload_file(
    file: UploadFile = File(...),
    category: str = Form("document"),
    current_user: dict = Depends(get_current_user)
):
    upload_category = validate_upload_category(category)
    extension = validate_upload_file(file)
    role = normalize_role(current_user.get("role"))
    school_id = current_user.get("school_id") if role != "super_admin" else "platform"

    if role != "super_admin" and not school_id:
        raise HTTPException(status_code=403, detail="School context required")

    payload = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(payload) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds upload size limit")

    safe_school_id = re.sub(r"[^a-zA-Z0-9_-]", "_", str(school_id))
    target_dir = UPLOAD_ROOT / safe_school_id / upload_category
    target_dir.mkdir(parents=True, exist_ok=True)

    file_id = f"{uuid.uuid4().hex}{extension}"
    target_path = target_dir / file_id
    target_path.write_bytes(payload)

    url = f"/uploads/{safe_school_id}/{upload_category}/{file_id}"
    await log_security_event(
        "file_uploaded",
        current_user,
        {
            "category": upload_category,
            "filename": file.filename,
            "content_type": file.content_type,
            "size": len(payload),
            "url": url,
        }
    )

    return api_success(
        {
            "url": url,
            "category": upload_category,
            "content_type": file.content_type,
            "size": len(payload),
        },
        message="File uploaded successfully"
    )


@api_router.patch("/school/profile")
async def update_school_profile(
    request: Request,
    current_user: dict = Depends(get_current_user)
):

    if normalize_role(current_user.get("role")) != "school_admin":
        raise HTTPException(status_code=403, detail="School admin access required")

    school_id = current_user.get("school_id")

    if not school_id:
        raise HTTPException(status_code=403, detail="No school assigned")

    try:
        payload = await request.json()
    except Exception:
        payload = {}

    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Invalid profile payload")

    allowed_fields = {
        "name",
        "phone",
        "address",
        "email",
        "school_type",
        "school_classification",
        "operation_type",
        "logo_url",
        "banner_url",
        "stamp_url",
        "motto",
        "vision",
        "mission",
        "principal_name",
        "principal_email",
        "principal_phone",
        "website",
        "established_year",
        "school_registration_number",
        "ministry_registration_number",
        "kra_pin"
        ,
        "theme_primary",
        "theme_secondary"
    }

    update_data = {
        key: value
        for key, value in payload.items()
        if key in allowed_fields and value is not None
    }

    if "operation_type" in update_data:
        operation_type = str(update_data["operation_type"] or "day").lower().strip()

        if operation_type not in ["day", "boarding", "mixed"]:
            raise HTTPException(
                status_code=400,
                detail="operation_type must be day, boarding, or mixed"
            )

        update_data["operation_type"] = operation_type
        update_data["boarding_enabled"] = operation_type in ["boarding", "mixed"]

    current_school = await db.schools.find_one({"id": school_id})
    if not current_school:
        raise HTTPException(status_code=404, detail="School not found")

    theme = dict(current_school.get("theme") or {})
    primary = update_data.pop("theme_primary", None)
    secondary = update_data.pop("theme_secondary", None)

    color_pattern = re.compile(r"^#[0-9a-fA-F]{6}$")
    for key, value in (("primary", primary), ("secondary", secondary)):
        if value is not None:
            value = str(value).strip()
            if not color_pattern.fullmatch(value):
                raise HTTPException(
                    status_code=400,
                    detail=f"theme_{key} must be a 6-digit hex color"
                )
            theme[key] = value

    if primary is not None or secondary is not None:
        update_data["theme"] = theme

    if not update_data:
        raise HTTPException(status_code=400, detail="No valid profile fields provided")

    update_data["updated_at"] = datetime.now(timezone.utc)

    await db.schools.update_one(
        {"id": school_id},
        {"$set": update_data}
    )
    await log_security_event(
        "school_profile_updated",
        current_user,
        {"fields": sorted(update_data.keys())}
    )

    updated_school = await db.schools.find_one({"id": school_id})

    return {
        "success": True,
        "message": "School profile updated successfully",
        "data": serialize_doc(updated_school)
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
        "role": {"$in": ["teacher", "finance", "secretary", "supporting_staff"]}
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

    staff_user_ids = [str(member.get("id") or member.get("_id")) for member in staff]
    staff_profiles = await db.staff.find(
        {"user_id": {"$in": staff_user_ids}},
        {"_id": 0}
    ).to_list(length=500)
    profile_by_user = {profile.get("user_id"): profile for profile in staff_profiles}

    enriched_staff = []
    for member in staff:
        member_id = str(member.get("id") or member.get("_id"))
        profile = profile_by_user.get(member_id) or {}
        merged = {
            **serialize_doc(member),
            "staff_profile": profile,
            "employee_number": profile.get("employee_number") or member.get("employee_number") or "-",
            "department": profile.get("department") or member.get("department") or role_label(member.get("role")),
            "position": profile.get("position") or member.get("position") or role_label(member.get("role")),
            "joined_date": profile.get("joined_date") or member.get("joined_date"),
            "salary": profile.get("salary") or member.get("salary"),
        }
        enriched_staff.append(merged)

    # =========================
    # RESPONSE
    # =========================
    return {
        "success": True,
        "data": enriched_staff
    }


@api_router.post("/staff")
async def create_staff(
    payload: CreateStaffPayload,
    current_user: dict = Depends(get_current_user)
):
    role = normalize_role(current_user.get("role"))

    if role not in ["school_admin", "super_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    school_id = str(current_user.get("school_id") or "").strip()

    if role != "super_admin" and not school_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No school assigned"
        )

    staff_role = normalize_role(payload.role)

    if staff_role not in ["teacher", "finance", "secretary", "supporting_staff"]:
        raise HTTPException(
            status_code=400,
            detail="Staff role must be teacher, finance, secretary, or supporting_staff"
        )

    validate_password_strength(payload.password)

    email = payload.email.lower().strip()

    existing = await db.users.find_one({
        "email": email,
        "school_id": school_id
    })

    if existing:
        raise HTTPException(status_code=400, detail="Staff email already exists")

    employee_existing = await db.staff.find_one({
        "school_id": school_id,
        "employee_number": payload.employee_number
    })

    if employee_existing:
        raise HTTPException(status_code=400, detail="Employee number already exists")

    now = now_utc()
    user_id = str(uuid.uuid4())
    actor_id = current_user.get("user_id")

    user_doc = {
        "id": user_id,
        "school_id": school_id,
        "email": email,
        "password_hash": hash_password(payload.password),
        "full_name": payload.full_name,
        "phone": payload.phone,
        "role": staff_role,
        "approval_status": "approved",
        "is_active": True,
        "is_suspended": False,
        "created_at": now,
        "updated_at": now
    }

    staff_doc = {
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "user_id": user_id,
        "employee_number": payload.employee_number,
        "department": payload.department,
        "position": payload.position,
        "salary": payload.salary,
        "joined_date": payload.joined_date,
        "created_by": actor_id,
        "created_at": now,
        "updated_at": now
    }

    await db.users.insert_one(user_doc)
    await db.staff.insert_one(staff_doc)
    await log_security_event(
        "staff_created",
        current_user,
        {
            "staff_user_id": user_id,
            "school_id": school_id,
            "role": staff_role,
            "employee_number": payload.employee_number,
        }
    )

    return api_success(
        {
            "user": serialize_doc(user_doc),
            "staff": serialize_doc(staff_doc)
        },
        message="Staff member created successfully"
    )


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
        "$or": [
            {"is_suspended": True},
            {"status": "deactivated"},
            {"approval_status": "deactivated"}
        ]
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
                    len(pending_users),
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
    item_type = (item_type or "").lower().strip()

    item_type_aliases = {
        "user": "users",
        "student": "students",
        "staff_member": "staff",
        "result": "results",
        "assessment": "results",
        "assessment_report": "results",
        "payment": "payments",
        "receipt": "payments",
        "fee_status": "students",
        "announcement": "announcements",
        "transaction": "finance_transactions",
        "finance_transaction": "finance_transactions",
        "inventory_item": "inventory"
    }

    item_type = item_type_aliases.get(item_type, item_type)

    collection_map = {
        "users": db.users,
        "students": db.students,
        "staff": db.staff,
        "results": db.results,
        "attendance": db.attendance,
        "payments": db.payments,
        "announcements": db.announcements,
        "transactions": db.finance_transactions,
        "finance_transactions": db.finance_transactions,
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
        **resource_lookup(item_id),
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
    action_time = datetime.now(timezone.utc)
    update_data = {
        "approval_status": action,
        "approval_role": role,
        "approval_reason": payload.reason,
        "approval_date": action_time,
        "updated_at": action_time
    }

    if action == "approved":
        update_data.update({
            "approved_by": user_id,
            "approved_at": action_time,
            "rejected_by": None,
            "rejected_at": None,
            "rejection_reason": None,
        })
    elif action == "rejected":
        update_data.update({
            "rejected_by": user_id,
            "rejected_at": action_time,
            "rejection_reason": payload.reason,
        })

    # =========================
    # USER-SPECIFIC LOGIC
    # =========================
    if item_type == "users":

        if action == "approved":
            update_data["is_active"] = True
            update_data["is_suspended"] = False
            update_data["status"] = "active"

        elif action == "rejected":
            update_data["is_active"] = False
            update_data["is_suspended"] = False
            update_data["status"] = "rejected"

    if item_type == "payments" and action == "approved":
        update_data["status"] = "completed"
        update_data["visible_to_student"] = True
        update_data["completed_at"] = datetime.now(timezone.utc)
    elif item_type == "payments" and action == "rejected":
        update_data["status"] = "rejected"
        update_data["visible_to_student"] = False
    elif item_type == "results":
        update_data["visible_to_student"] = action == "approved"
    elif item_type == "students" and item.get("fee_status_approval_status") == "pending":
        update_data["fee_status_approval_status"] = action
        update_data["fee_status_visible"] = action == "approved"

    # =========================
    # UPDATE DB
    # =========================
    await collection.update_one(
        query,
        {"$set": update_data}
    )

    # =========================
    # FETCH UPDATED ITEM
    # =========================
    updated_item = await collection.find_one(query)
    await log_security_event(
        "approval_action",
        current_user,
        {
            "item_type": item_type,
            "item_id": item_id,
            "approval_status": action,
            "reason": payload.reason,
        }
    )

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


@api_router.patch("/admin/users/{user_id}/deactivate")
async def deactivate_school_user(
    user_id: str,
    payload: dict,
    current_user: dict = Depends(get_current_user)
):
    role = normalize_role(current_user.get("role"))
    school_id = current_user.get("school_id")
    if role not in {"school_admin", "super_admin"}:
        raise HTTPException(status_code=403, detail="Not authorized")

    query = resource_lookup(user_id)
    if role == "school_admin":
        if not school_id:
            raise HTTPException(status_code=403, detail="No school assigned")
        query["school_id"] = school_id

    target = await db.users.find_one(query)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if normalize_role(target.get("role")) in {"school_admin", "super_admin"} and role != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admin can deactivate administrators")

    reason = str(payload.get("reason") or "Former user").strip()
    await db.users.update_one(
        query,
        {"$set": {
            "is_active": False,
            "is_suspended": True,
            "approval_status": "deactivated",
            "status": "deactivated",
            "deactivation_reason": reason,
            "deactivated_by": current_user.get("user_id") or current_user.get("id"),
            "deactivated_at": now_iso(),
            "updated_at": now_iso(),
        }}
    )
    await log_security_event("user_deactivated", current_user, {"target_user_id": user_id, "reason": reason})
    return {"success": True, "message": "User deactivated"}


@api_router.patch("/admin/users/{user_id}/approve")
async def approve_school_user(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    return await set_school_user_access_status(
        user_id,
        "approved",
        current_user
    )


@api_router.patch("/admin/users/{user_id}/reject")
async def reject_school_user(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    return await set_school_user_access_status(
        user_id,
        "rejected",
        current_user
    )


async def set_school_user_access_status(
    user_id: str,
    next_status: str,
    current_user: dict
):
    role = normalize_role(current_user.get("role"))
    school_id = current_user.get("school_id")
    if role not in {"school_admin", "super_admin"}:
        raise HTTPException(status_code=403, detail="Not authorized")

    if next_status not in {"approved", "rejected"}:
        raise HTTPException(status_code=400, detail="Invalid user action")

    query = resource_lookup(user_id)
    if role == "school_admin":
        if not school_id:
            raise HTTPException(status_code=403, detail="No school assigned")
        query["school_id"] = school_id

    target = await db.users.find_one(query)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if normalize_role(target.get("role")) in {"school_admin", "super_admin"} and role != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admin can manage administrators")

    actor_id = current_user.get("user_id") or current_user.get("id")
    now = now_utc()

    if next_status == "approved":
        update_data = {
            "approval_status": "approved",
            "status": "active",
            "is_active": True,
            "is_suspended": False,
            "approved_by": actor_id,
            "approved_at": now,
            "approval_date": now,
            "rejected_by": None,
            "rejected_at": None,
            "rejection_reason": None,
            "updated_at": now,
        }
        message = "User approved"
    else:
        update_data = {
            "approval_status": "rejected",
            "status": "rejected",
            "is_active": False,
            "is_suspended": False,
            "rejected_by": actor_id,
            "rejected_at": now,
            "rejection_reason": None,
            "updated_at": now,
        }
        message = "User rejected"

    await db.users.update_one(query, {"$set": update_data})
    updated_user = await db.users.find_one(query)

    if next_status == "approved" and normalize_role(target.get("role")) in STAFF_JOIN_ROLES:
        staff_role = normalize_role(target.get("role"))
        existing_staff = await db.staff.find_one({
            "school_id": target.get("school_id"),
            "user_id": str(target.get("id") or target.get("_id")),
        })
        if not existing_staff:
            employee_number = f"EMP-{str(target.get('id') or user_id).replace('-', '')[:8].upper()}"
            await db.staff.insert_one({
                "id": str(uuid.uuid4()),
                "school_id": target.get("school_id"),
                "user_id": str(target.get("id") or target.get("_id")),
                "employee_number": employee_number,
                "department": target.get("department") or ("Academics" if staff_role == "teacher" else role_label(staff_role)),
                "position": target.get("position") or role_label(staff_role),
                "role": staff_role,
                "salary": None,
                "joined_date": now,
                "created_by": actor_id,
                "created_at": now,
                "updated_at": now,
            })

    await log_security_event(
        f"user_{next_status}",
        current_user,
        {
            "target_user_id": user_id,
            "target_school_id": target.get("school_id"),
            "target_role": target.get("role"),
        }
    )

    return {
        "success": True,
        "message": message,
        "user": serialize_doc(updated_user)
    }


@api_router.patch("/admin/users/{user_id}/reactivate")
async def reactivate_school_user(
    user_id: str,
    payload: dict,
    current_user: dict = Depends(get_current_user)
):
    role = normalize_role(current_user.get("role"))
    school_id = current_user.get("school_id")
    if role not in {"school_admin", "super_admin"}:
        raise HTTPException(status_code=403, detail="Not authorized")

    query = resource_lookup(user_id)
    if role == "school_admin":
        if not school_id:
            raise HTTPException(status_code=403, detail="No school assigned")
        query["school_id"] = school_id

    target = await db.users.find_one(query)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if normalize_role(target.get("role")) in {"school_admin", "super_admin"} and role != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admin can reactivate administrators")
    if str(target.get("approval_status") or "").lower() == "rejected":
        raise HTTPException(status_code=400, detail="Rejected users must be approved before reactivation")

    reason = str(payload.get("reason") or "Reactivated by school admin").strip()
    actor_id = current_user.get("user_id") or current_user.get("id")
    await db.users.update_one(
        query,
        {"$set": {
            "approval_status": "approved",
            "is_active": True,
            "is_suspended": False,
            "status": "active",
            "reactivation_reason": reason,
            "reactivated_by": actor_id,
            "reactivated_at": now_iso(),
            "updated_at": now_iso(),
        }}
    )
    await log_security_event("user_reactivated", current_user, {"target_user_id": user_id, "reason": reason})
    return {"success": True, "message": "User reactivated"}


# =========================
# AUTH
# =========================

@api_router.get("/public/schools/resolve/{school_code}")
async def resolve_school_code(school_code: str):
    normalized_code = str(school_code or "").strip().upper()

    if not re.fullmatch(r"(SMH-KE-\d{6}|SMH-[A-Z0-9]{8,12})", normalized_code):
        raise HTTPException(status_code=400, detail="Invalid school code format")

    school = await db.schools.find_one({
        "school_code": normalized_code,
        "is_active": {"$ne": False}
    })

    if not school:
        raise HTTPException(status_code=404, detail="School code not found")

    school = await ensure_school_identity(school)

    return {
        "success": True,
        "data": school_branding_payload(school)
    }


@api_router.get("/public/schools/resolve/{school_code}/classes")
async def resolve_school_classes(school_code: str):
    normalized_code = str(school_code or "").strip().upper()

    if not re.fullmatch(r"(SMH-KE-\d{6}|SMH-[A-Z0-9]{8,12})", normalized_code):
        raise HTTPException(status_code=400, detail="Invalid school code format")

    school = await db.schools.find_one({
        "school_code": normalized_code,
        "is_active": {"$ne": False}
    })

    if not school:
        raise HTTPException(status_code=404, detail="School code not found")

    class_names = await get_school_class_names(str(school.get("id")))

    return {
        "success": True,
        "data": {
            "school": school_branding_payload(await ensure_school_identity(school)),
            "classes": class_names
        }
    }


@api_router.get("/public/schools/invite/{invite_code}/classes")
async def resolve_invite_school_classes(invite_code: str):
    school = await find_school_for_join(invite_code=invite_code)

    if not school or school.get("is_active") is False:
        raise HTTPException(status_code=404, detail="Invite link not found")

    class_names = await get_school_class_names(str(school.get("id")))

    return {
        "success": True,
        "data": {
            "school": school_branding_payload(await ensure_school_identity(school)),
            "classes": class_names
        }
    }


@api_router.post("/auth/register-school")
async def register_school(payload: RegisterSchoolRequest, request: Request):

    try:

        # =========================
        # NORMALIZED INPUTS
        # =========================
        school_email = payload.email.lower().strip()
        admin_email = payload.admin_email.lower().strip()
        school_phone = str(payload.phone or "").strip()
        admin_phone = str(payload.admin_phone or "").strip()

        # =========================
        # DUPLICATE CHECKS (SAFE)
        # =========================
        existing_school = await db.schools.find_one({"email": school_email})

        if existing_school:
            raise HTTPException(status_code=400, detail="A school with this email is already registered")

        existing_school_phone = await db.schools.find_one({"phone": school_phone})

        if existing_school_phone:
            raise HTTPException(status_code=400, detail="A school with this phone number is already registered")

        existing_admin = await db.users.find_one({
            "email": admin_email
        })

        if existing_admin:
            raise HTTPException(status_code=400, detail="An administrator with this email already exists")

        if admin_phone:
            existing_admin_phone = await db.users.find_one({"phone": admin_phone})
            if existing_admin_phone:
                raise HTTPException(status_code=400, detail="An administrator with this phone number already exists")

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
        await db.schools.create_index(
            "school_code",
            unique=True,
            sparse=True,
            name="unique_school_code"
        )
        school_code = await generate_school_code()
        invite_code = generate_invite_code()

        initials = generate_initials(payload.name)

        fingerprint = f"{initials}-{invite_code}"

        join_slug = f"{clean_slug(payload.name)}-{invite_code}"

        frontend_url = (os.getenv("FRONTEND_URL") or request.headers.get("origin") or get_frontend_url()).rstrip("/")
        invite_link = f"{frontend_url}/join/{join_slug}"
        login_link = f"{frontend_url}/login?school={school_code}"

        now = datetime.now(timezone.utc)

        operation_type = str(payload.operation_type or "day").lower().strip()
        if operation_type not in ["day", "boarding", "mixed"]:
            raise HTTPException(
                status_code=400,
                detail="operation_type must be day, boarding, or mixed"
            )

        if payload.admin_password:
            validate_password_strength(payload.admin_password)
            temporary_password = payload.admin_password
        else:
            temporary_password = generate_temporary_password()
        billing_day = now.day

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
            "login_link": login_link,

            "address": payload.address,
            "phone": school_phone,
            "email": school_email,
            "school_type": payload.school_type,
            "school_classification": payload.school_classification,
            "curriculum": payload.curriculum or "CBC",
            "ownership": payload.ownership,
            "operation_type": operation_type,
            "boarding_enabled": operation_type in ["boarding", "mixed"],
            "alternative_phone": payload.alternative_phone,
            "country": payload.country,
            "county": payload.county,
            "sub_county": payload.sub_county,
            "town": payload.town,
            "postal_address": payload.postal_address,

            "logo_url": payload.logo_url,
            "banner_url": payload.banner_url,
            "stamp_url": payload.stamp_url,
            "motto": payload.motto,
            "vision": payload.vision,
            "mission": payload.mission,
            "principal_name": payload.principal_name,
            "principal_email": payload.principal_email,
            "principal_phone": payload.principal_phone,
            "website": payload.website,
            "established_year": payload.established_year,
            "school_registration_number": payload.school_registration_number,
            "ministry_registration_number": payload.ministry_registration_number,
            "kra_pin": payload.kra_pin,
            "theme": {
                "primary": payload.theme_primary or "#10B981",
                "secondary": payload.theme_secondary or "#0F172A"
            },
            "academic_structure": [],

            "status": "pending_approval",
            "is_active": False,
            "approval_status": "pending",
            "subscription_plan": "standard",
            "subscription_status": "inactive",
            "subscription_amount": 2000,
            "billing_day": billing_day,
            "installation_fee": 5000,
            "payment_status": "pending",
            "payment_verification_status": "awaiting_payment_phone",
            "registration_payment_phone": None,

            "blocked_users": [],

            "created_at": now,
            "updated_at": now
        }

        try:
            await db.schools.insert_one(school)
        except DuplicateKeyError:
            raise HTTPException(
                status_code=409,
                detail="Generated school code already exists. Please retry."
            )

        # =========================
        # ADMIN USER
        # =========================
        admin = {
            "id": admin_id,
            "full_name": payload.admin_name,
            "email": admin_email,
            "phone": admin_phone or None,

            "password_hash": hash_password(temporary_password),

            # ROLE SYSTEM (CRITICAL)
            "role": "school_admin",

            # RELATION
            "school_id": school_id,
            "school_name": payload.name,
            "school_fingerprint": fingerprint,

            # APPROVAL
            "approval_status": "pending",
            "is_active": False,
            "is_suspended": False,
            "temporary_password": temporary_password,
            "username": payload.name,
            "national_id": payload.admin_national_id,
            "admin_role": payload.admin_role or "School Administrator",

            "last_login": None,

            "created_at": now,
            "updated_at": now
        }

        await db.users.insert_one(admin)

        invoice = {
            "id": str(uuid.uuid4()),
            "school_id": school_id,
            "school_name": payload.name,
            "invoice_type": "installation",
            "invoice_number": f"INV-{school_code}-{now.strftime('%Y%m%d')}",
            "amount": 5000,
            "currency": "KES",
            "status": "pending",
            "description": "SMART M HUB installation fee",
            "created_at": now,
            "updated_at": now
        }
        await db.platform_invoices.insert_one(invoice)
        await log_security_event(
            "school_registered",
            admin,
            {
                "school_id": school_id,
                "school_code": school_code,
                "invoice_id": invoice["id"],
                "approval_status": "pending",
            }
        )

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
            "message": "School registered successfully. Installation payment and super admin approval are required before login.",

            "school_id": school_id,
            "school_name": payload.name,
            "school_slug": school_slug,
            "school_code": school_code,

            "initials": initials,
            "invite_code": invite_code,
            "fingerprint": fingerprint,
            "join_slug": join_slug,
            "invite_link": invite_link,
            "login_link": login_link,
            "operation_type": operation_type,
            "boarding_enabled": operation_type in ["boarding", "mixed"],
            "branding": school_branding_payload(school),

            "approval_status": "pending",
            "payment_status": "pending",
            "installation_invoice": serialize_doc(invoice),
            "generated_credentials": {
                "username": payload.name,
                "temporary_password": temporary_password,
                "login_link": login_link
            },

            "user": {
                "id": admin_id,
                "email": admin_email,
                "full_name": payload.admin_name,
                "role": "school_admin",
                "school_id": school_id,
                "school_name": payload.name,
                "school_code": school_code,
                "school_branding": school_branding_payload(school),
                "approval_status": "pending",
                "is_active": False
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

@api_router.post("/auth/register-school/payment-phone")
async def submit_registration_payment_phone(payload: RegistrationPaymentPhoneRequest, request: Request):
    school_id = str(payload.school_id or "").strip()
    school_code = str(payload.school_code or "").strip().upper()
    payment_phone = str(payload.payment_phone or "").strip()

    if not school_id or not school_code:
        raise HTTPException(status_code=400, detail="School registration reference is required")

    if not re.fullmatch(r"\+?\d[\d\s-]{7,18}", payment_phone):
        raise HTTPException(status_code=400, detail="Enter the phone number used to make payment")

    school = await db.schools.find_one({"id": school_id, "school_code": school_code})
    if not school:
        raise HTTPException(status_code=404, detail="School registration not found")

    if str(school.get("approval_status") or "pending").lower() == "approved":
        raise HTTPException(status_code=400, detail="This school has already been approved")

    now = now_utc()
    await db.schools.update_one(
        {"_id": school["_id"]},
        {"$set": {
            "registration_payment_phone": payment_phone,
            "payment_phone_number": payment_phone,
            "payment_status": "verification_pending",
            "payment_verification_status": "pending_verification",
            "updated_at": now,
        }}
    )
    await db.platform_invoices.update_many(
        {"school_id": school_id, "invoice_type": "installation"},
        {"$set": {
            "payment_phone_number": payment_phone,
            "payment_verification_status": "pending_verification",
            "status": "verification_pending",
            "updated_at": now,
        }}
    )
    await log_security_event(
        "registration_payment_submitted",
        metadata={
            "school_id": school_id,
            "school_code": school_code,
            "payment_phone_number": payment_phone,
            "origin": request.headers.get("origin"),
        },
    )

    return {
        "success": True,
        "message": "Your payment is being verified. The support team will approve your school soon.",
        "payment_status": "verification_pending",
        "payment_verification_status": "pending_verification",
    }


@api_router.post("/auth/join-school")
async def join_school(request: dict):

    try:

        # =========================
        # INPUT NORMALIZATION
        # =========================
        invite_code = (request.get("invite_code") or "").strip().upper()
        school_code = (request.get("school_code") or "").strip().upper()
        email = (request.get("email") or "").strip().lower()
        password = request.get("password") or ""
        full_name = (request.get("full_name") or "").strip()
        phone = (request.get("phone") or "").strip() or None
        raw_role = (request.get("role") or "teacher")
        admission_number = (request.get("admission_number") or "").strip() or None
        student_access_code = (request.get("student_access_code") or "").strip().upper() or None
        selected_classes = request.get("selected_classes") or []
        child_name = (request.get("child_name") or "").strip() or None
        child_admission_number = (request.get("child_admission_number") or "").strip() or None

        role = normalize_role(raw_role).lower()

        # =========================
        # VALIDATION
        # =========================
        if not invite_code and not school_code:
            raise HTTPException(status_code=400, detail="School code or invite code is required")

        if not email or not password or not full_name:
            raise HTTPException(
                status_code=400,
                detail="Email, password, and full name are required"
            )

        validate_password_strength(password)

        # =========================
        # ROLE VALIDATION
        # =========================
        allowed_roles = ["teacher", "parent", "finance", "secretary", "supporting_staff"]

        if role not in allowed_roles:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid role. Allowed roles: {allowed_roles}"
            )

        # =========================
        # FIND SCHOOL
        # =========================
        school = await find_school_for_join(school_code, invite_code)

        if not school:
            raise HTTPException(status_code=404, detail="Invalid school code or invite code")

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

        linked_student = None
        if role == "parent":
            if not child_name or not child_admission_number:
                raise HTTPException(status_code=400, detail="Child name and admission number are required for Parent/Guardian")
            linked_student = await db.students.find_one({
                "school_id": school_id,
                "admission_number": child_admission_number,
            })

        if role == "teacher":
            if not isinstance(selected_classes, list):
                raise HTTPException(status_code=400, detail="Selected classes must be a list")

            selected_classes = [
                str(class_name or "").strip()
                for class_name in selected_classes
                if str(class_name or "").strip()
            ]

            if not selected_classes:
                raise HTTPException(status_code=400, detail="Select at least one class")

            allowed_classes = set(await get_school_class_names(school_id))
            invalid_classes = [
                class_name
                for class_name in selected_classes
                if class_name not in allowed_classes
            ]
            if invalid_classes:
                raise HTTPException(status_code=400, detail="One or more selected classes do not belong to this school")
        else:
            selected_classes = []

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
            "phone": phone,

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
            "student_access_code": student_access_code,
            "student_id": linked_student.get("id") if linked_student else None,
            "selected_classes": selected_classes,
            "child_name": child_name,
            "child_admission_number": child_admission_number,
            "join_request_submitted_at": now_utc(),

            # =========================
            # TIMESTAMPS
            # =========================
            "created_at": now_utc(),
            "updated_at": now_utc()
        }

        await db.users.insert_one(user)
        await log_security_event(
            "join_school_requested",
            user,
            {
                "school_id": school_id,
                "role": role,
                "approval_status": "pending",
            }
        )

        # =========================
        # RESPONSE
        # =========================
        return {
            "success": True,
            "message": "Your request has been submitted and is waiting for school administrator approval.",

            "user": {
                "id": user["id"],
                "email": email,
                "full_name": full_name,
                "phone": phone,
                "role": role,
                "school_id": school_id,
                "school_name": school_name,
                "approval_status": "pending",
                "is_active": False,
                "selected_classes": selected_classes,
                "child_name": child_name,
                "child_admission_number": child_admission_number
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
        school_code = (request.school_code or "").strip().upper()

        if not email or not password:
            raise HTTPException(status_code=400, detail="Email and password required")

        await assert_login_not_locked(email, school_code)

        user_query = {"email": email}
        login_school = None

        if school_code:
            login_school = await db.schools.find_one({
                "school_code": school_code
            })
            if not login_school:
                raise HTTPException(status_code=404, detail="School code not found")
            user_query["school_id"] = str(login_school.get("id"))

        user = await db.users.find_one(user_query)

        if not user and login_school and email == str(login_school.get("email") or "").strip().lower():
            user = await db.users.find_one({
                "school_id": str(login_school.get("id")),
                "role": "school_admin",
            })
            if user:
                await log_security_event(
                    "login_school_email_alias_used",
                    user,
                    {
                        "school_id": str(login_school.get("id")),
                        "school_code": school_code,
                        "login_email": email,
                        "admin_email": user.get("email"),
                    },
                )

        if not user:
            await record_login_failure(email, school_code, "user_not_found")
            await log_security_event("login_failed", metadata={"email": email, "school_code": school_code, "reason": "user_not_found"})
            raise HTTPException(status_code=401, detail="Invalid login details")

        user_id = user.get("id") or str(user.get("_id"))

        stored_hash = user.get("password_hash") or user.get("hashed_password")

        if not stored_hash or not verify_password(password, stored_hash):
            await record_login_failure(email, school_code, "invalid_password")
            await log_security_event("login_failed", user, {"email": email, "school_code": school_code, "reason": "invalid_password"})
            raise HTTPException(status_code=401, detail="Invalid login details")

        db_role = normalize_role(user.get("role") or "")
        if not db_role:
            await record_login_failure(email, school_code, "invalid_role")
            await log_security_event("login_blocked", user, {"reason": "invalid_role"})
            raise HTTPException(status_code=403, detail="Invalid login details")

        approval_status = (user.get("approval_status") or "pending").lower()

        if approval_status == "deactivated" or str(user.get("status") or "").lower() == "deactivated" or user.get("is_suspended") is True:
            await record_login_failure(email, school_code, "account_deactivated")
            await log_security_event("login_blocked", user, {"reason": "account_deactivated"})
            raise HTTPException(status_code=403, detail="Your account has been deactivated.")

        if approval_status == "rejected":
            await record_login_failure(email, school_code, "account_rejected")
            await log_security_event("login_blocked", user, {"reason": "account_rejected"})
            raise HTTPException(status_code=403, detail="Your request was rejected.")

        if approval_status != "approved":
            await record_login_failure(email, school_code, "account_not_approved")
            await log_security_event("login_blocked", user, {"reason": "account_not_approved"})
            raise HTTPException(status_code=403, detail="Your account is waiting for approval.")

        if user.get("is_active") is False:
            await record_login_failure(email, school_code, "account_deactivated")
            await log_security_event("login_blocked", user, {"reason": "account_deactivated"})
            raise HTTPException(status_code=403, detail="Your account has been deactivated.")

        school_id = user.get("school_id")

        student_identifier = (request.student_access_code or "").strip().upper()
        admission_identifier = (request.admission_number or "").strip()
        if db_role in {"student", "parent"} and (student_identifier or admission_identifier):
            student_conditions = []
            if user.get("student_id"):
                student_conditions.append({"id": user.get("student_id")})
            if student_identifier:
                student_conditions.append({"student_access_code": student_identifier})
            if admission_identifier:
                student_conditions.append({"admission_number": admission_identifier})
            linked_student = await db.students.find_one({
                "school_id": school_id,
                "approval_status": "approved",
                "$or": student_conditions,
            })
            if not linked_student:
                await record_login_failure(email, school_code, "student_access_mismatch")
                await log_security_event("login_blocked", user, {"reason": "student_access_mismatch", "school_id": school_id})
                raise HTTPException(status_code=403, detail="Student access code or admission number is invalid")
            await db.users.update_one(
                {"id": user_id},
                {"$set": {
                    "student_id": linked_student.get("id"),
                    "student_access_code": linked_student.get("student_access_code"),
                    "admission_number": linked_student.get("admission_number"),
                    "updated_at": now_iso(),
                }}
            )

        school = login_school
        if school_id:
            school = school or await db.schools.find_one({"id": school_id})
            if school:
                school = await ensure_school_identity(school)
                school_approval = str(school.get("approval_status") or "pending").lower()
                school_subscription = str(school.get("subscription_status") or "inactive").lower()
                school_status = str(school.get("status") or "").lower()

                if school_approval != "approved":
                    await record_login_failure(email, school_code, "school_not_approved")
                    await log_security_event("login_blocked", user, {"reason": "school_not_approved", "school_id": school_id})
                    raise HTTPException(status_code=403, detail="School is pending platform approval")

                if school.get("is_active") is False or school_status in {"suspended", "inactive", "pending_approval"}:
                    await record_login_failure(email, school_code, "school_disabled")
                    await log_security_event("login_blocked", user, {"reason": "school_disabled", "school_id": school_id})
                    raise HTTPException(status_code=403, detail="School access is disabled")

                if school_subscription in {"expired", "suspended", "inactive"}:
                    await record_login_failure(email, school_code, "subscription_inactive")
                    await log_security_event("login_blocked", user, {"reason": "subscription_inactive", "school_id": school_id})
                    raise HTTPException(status_code=403, detail="School subscription is not active")

        await clear_login_failures(email, school_code)

        await db.users.update_one(
            {"id": user_id},
            {"$set": {"last_login": now_iso(), "updated_at": now_iso()}}
        )

        await log_security_event("login_success", user, {"school_id": school_id, "role": db_role})

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
                "school_code": school.get("school_code") if school else None,
                "school_branding": school_branding_payload(school) if school else None,
                "approval_status": approval_status,
                "is_active": user.get("is_active", True),
                "is_suspended": user.get("is_suspended", False)
            },
            "school": serialize_doc(school) if school else None
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"LOGIN ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail="Login failed")


@api_router.post("/auth/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    email = str(request.email or "").strip().lower()
    school_code = str(request.school_code or "").strip().upper()
    query = {"email": email}
    if school_code:
        school = await db.schools.find_one({"school_code": school_code})
        if not school:
            raise HTTPException(status_code=404, detail="School code not found")
        query["school_id"] = str(school.get("id"))

    user = await db.users.find_one(query)
    if not user:
        await log_security_event("password_reset_requested_unknown", metadata={"email": email, "school_code": school_code})
        return {"success": True, "message": "If the account exists, a verification code has been sent."}

    phone = str(user.get("phone") or user.get("phone_number") or "").strip()
    if not phone:
        raise HTTPException(status_code=400, detail="No phone number is registered for this account")

    code = generate_verification_code()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
    await db.password_reset_codes.update_many(
        {"user_id": user.get("id"), "used": {"$ne": True}},
        {"$set": {"used": True, "updated_at": now_iso()}}
    )
    await db.password_reset_codes.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user.get("id"),
        "email": email,
        "school_id": user.get("school_id"),
        "code": code,
        "expires_at": expires_at,
        "used": False,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    })
    await log_security_event("password_reset_code_created", user, {"expires_at": expires_at.isoformat()})
    masked_phone = f"{phone[:3]}***{phone[-3:]}" if len(phone) > 6 else "***"
    return {
        "success": True,
        "message": "Verification code sent to the registered phone number.",
        "sent_to_phone": masked_phone,
        "expires_in_minutes": 15,
    }


@api_router.post("/auth/reset-password")
async def reset_password_with_code(request: VerifyResetCodeRequest):
    email = str(request.email or "").strip().lower()
    school_code = str(request.school_code or "").strip().upper()
    query = {"email": email}
    if school_code:
        school = await db.schools.find_one({"school_code": school_code})
        if not school:
            raise HTTPException(status_code=404, detail="School code not found")
        query["school_id"] = str(school.get("id"))

    user = await db.users.find_one(query)
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired verification code")

    reset_record = await db.password_reset_codes.find_one({
        "user_id": user.get("id"),
        "code": str(request.code or "").strip(),
        "used": False,
    })
    if not reset_record:
        await log_security_event("password_reset_failed", user, {"reason": "invalid_code"})
        raise HTTPException(status_code=400, detail="Invalid or expired verification code")

    expires_at = reset_record.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if not expires_at or expires_at < datetime.now(timezone.utc):
        await db.password_reset_codes.update_one({"id": reset_record.get("id")}, {"$set": {"used": True, "updated_at": now_iso()}})
        await log_security_event("password_reset_failed", user, {"reason": "expired_code"})
        raise HTTPException(status_code=400, detail="Invalid or expired verification code")

    validate_password_strength(request.new_password)
    await db.users.update_one(
        {"id": user.get("id")},
        {"$set": {
            "password_hash": hash_password(request.new_password),
            "approval_status": "pending",
            "is_active": False,
            "updated_at": now_iso(),
        }}
    )
    await db.password_reset_codes.update_one(
        {"id": reset_record.get("id")},
        {"$set": {"used": True, "updated_at": now_iso()}}
    )
    await log_security_event("password_reset_completed", user, {"requires_admin_approval": True})
    return {"success": True, "message": "Password reset. Admin approval is required before access is restored."}

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

    if role != "school_admin":
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

    frontend_url = get_frontend_url()

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
        await log_security_event(
            "school_updated",
            current_user,
            {"school_id": school_id, "fields": sorted(update_data.keys())}
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
        admission_number = request.admission_number or await generate_admission_number(school_id)

        existing_student = await db.students.find_one({
            "school_id": school_id,
            "admission_number": admission_number
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
        student_access_code = await generate_student_access_code(school_id)
        student_data = {
            "id": str(uuid.uuid4()),
            "school_id": school_id,

            "admission_number": admission_number,
            "student_id": f"STU-{admission_number}",
            "student_access_code": student_access_code,
            "passport_photo_url": request.passport_photo_url,
            "full_name": request.full_name,
            "date_of_birth": (
                datetime.fromisoformat(request.date_of_birth)
                if request.date_of_birth
                else None
            ),
            "gender": request.gender,
            "birth_certificate_no": request.birth_certificate_no,
            "nationality": request.nationality,
            "religion": request.religion,
            "special_needs": request.special_needs,

            "class_name": request.class_name,
            "education_level": classify_school_level(request.class_name),
            "year_of_study": request.year_of_study,
            "stream": request.stream,

            "guardian_name": request.guardian_name,
            "guardian_phone": request.guardian_phone,
            "guardian_email": request.guardian_email,
            "guardian_relationship": request.guardian_relationship,
            "guardian_occupation": request.guardian_occupation,
            "guardian_national_id": request.guardian_national_id,
            "guardian_address": request.guardian_address,

            "secondary_guardian_name": request.secondary_guardian_name,
            "secondary_guardian_phone": request.secondary_guardian_phone,
            "secondary_guardian_email": request.secondary_guardian_email,
            "secondary_guardian_relationship": request.secondary_guardian_relationship,
            "secondary_guardian_occupation": request.secondary_guardian_occupation,
            "secondary_guardian_national_id": request.secondary_guardian_national_id,
            "secondary_guardian_address": request.secondary_guardian_address,

            "blood_type": request.blood_type,
            "allergies": request.allergies,
            "chronic_conditions": request.chronic_conditions,
            "disabilities": request.disabilities,
            "immunization_status": request.immunization_status,
            "medical_info": request.medical_info,
            "medication": request.medication,
            "hospital_letter_url": request.hospital_letter_url,
            "previous_school": request.previous_school,
            "transfer_reason": request.transfer_reason,
            "last_class": request.last_class,
            "documents_attached": request.documents_attached or [],

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
        await log_security_event(
            "student_created",
            current_user,
            {
                "student_id": student_data["id"],
                "admission_number": admission_number,
                "approval_status": student_data["approval_status"],
            }
        )

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
            "admission_number": admission_number,
            "student_access_code": student_access_code,
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

    for student in students:
        student["education_level"] = student.get("education_level") or classify_school_level(student.get("class_name"))

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

        student = None
        if request.student_id:
            student = await db.students.find_one({
                "id": request.student_id,
                "school_id": school_id,
            })
            if not student:
                raise HTTPException(status_code=404, detail="Student not found")

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
            "receipt_number": f"RCP-{now.strftime('%Y%m%d')}-{payment_id[:8].upper()}",
            "amount": request.amount,
            "payment_type": request.payment_type,
            "payment_method": method,
            "term": request.term,
            "academic_year": request.academic_year,
            "received_from": request.received_from or (student.get("guardian_name") if student else None),
            "transaction_reference": request.transaction_reference,
            "payment_breakdown": request.payment_breakdown or [],
            "total_amount_due": request.total_amount_due,
            "total_paid": request.amount,
            "outstanding_balance": request.outstanding_balance,
            "student_name": student.get("full_name") if student else None,
            "admission_number": student.get("admission_number") if student else None,

            "phone_number": phone,
            "bank_reference": request.bank_reference,
            "cheque_number": request.cheque_number,
            "description": request.description,
            "receipt_url": request.receipt_url,

            # =========================
            # PAYMENT STATE
            # =========================
            "status": "completed" if auto_approve else "pending",
            "visible_to_student": bool(auto_approve),

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
        payment["payment_breakdown"] = receipt_breakdown(payment)
        await db.payments.update_one({"id": payment_id}, {"$set": {"payment_breakdown": payment["payment_breakdown"]}})
        await log_security_event(
            "payment_recorded",
            current_user,
            {
                "payment_id": payment["id"],
                "student_id": request.student_id,
                "amount": payment["amount"],
                "approval_status": payment["approval_status"],
            }
        )

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
            "receipt_number": payment["receipt_number"],
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
@api_router.get("/payments")
async def get_payments(
    approval_status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    try:
        school_id = current_user.get("school_id")

        if not school_id:
            raise HTTPException(status_code=403, detail="No school assigned")

        role = normalize_role(current_user.get("role"))

        query = {
            "school_id": school_id
        }

        if role not in ["school_admin", "finance", "super_admin"]:
            query["approval_status"] = "approved"
        elif approval_status and approval_status != "all":
            query["approval_status"] = approval_status.lower()

        payments = await db.payments.find(
            query,
            {"_id": 0}
        ).sort("created_at", -1).to_list(1000)

        return {
            "success": True,
            "data": serialize_docs(payments)
        }

    except Exception as e:
        logger.error(f"Fetch payments error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error"
        )    


@api_router.get("/students/{student_id}/fee-profile")
async def get_student_fee_profile(
    student_id: str,
    current_user: dict = Depends(get_current_user)
):
    school_id = current_user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=403, detail="No school assigned")

    role = normalize_role(current_user.get("role"))
    if role not in {"school_admin", "finance", "secretary"}:
        raise HTTPException(status_code=403, detail="Unauthorized")

    student = await db.students.find_one(
        {"id": student_id, "school_id": school_id},
        {"_id": 0}
    )
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    payments = await db.payments.find(
        {"student_id": student_id, "school_id": school_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(500)

    fee_structures = await db.fee_structures.find(
        {"school_id": school_id, "class_name": student.get("class_name")},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)

    total_due = sum(float(item.get("amount") or 0) for item in fee_structures)
    approved_paid = sum(
        float(payment.get("amount") or 0)
        for payment in payments
        if payment.get("approval_status") == "approved" and payment.get("status") in {"completed", "approved", "paid"}
    )
    balance = total_due - approved_paid

    for payment in payments:
        payment["year"] = payment.get("academic_year") or str(payment.get("created_at") or "")[:4]
        payment["payment_breakdown"] = receipt_breakdown(payment)
        payment["balance_after_payment"] = payment.get("outstanding_balance")

    return {
        "success": True,
        "student": {
            **student,
            "education_level": student.get("education_level") or classify_school_level(student.get("class_name")),
        },
        "payments": payments,
        "fee_structures": fee_structures,
        "summary": {
            "total_due": total_due,
            "total_paid": approved_paid,
            "balance": balance,
            "pending_receipts": len([p for p in payments if p.get("approval_status") == "pending"]),
        }
    }


@api_router.patch("/finance/fee-status")
async def set_student_fee_status(
    request: FeeStatusRequest,
    current_user: dict = Depends(get_current_user)
):
    school_id = current_user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=403, detail="No school assigned")

    role = normalize_role(current_user.get("role"))
    if role not in {"finance", "school_admin"}:
        raise HTTPException(status_code=403, detail="Unauthorized")

    student = await db.students.find_one({"id": request.student_id, "school_id": school_id})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    fee_status = normalize_fee_status(request.status)
    auto_approve = role == "school_admin"
    update = {
        "fee_status": fee_status,
        "fee_status_note": request.note,
        "fee_status_approval_status": "approved" if auto_approve else "pending",
        "fee_status_visible": auto_approve,
        "fee_status_set_by": current_user.get("user_id") or current_user.get("id"),
        "updated_at": now_iso(),
    }
    await db.students.update_one({"id": request.student_id, "school_id": school_id}, {"$set": update})
    await db.fee_status_history.insert_one({
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "student_id": request.student_id,
        "status": fee_status,
        "note": request.note,
        "approval_status": update["fee_status_approval_status"],
        "created_by": current_user.get("user_id") or current_user.get("id"),
        "created_at": now_iso(),
    })
    await log_security_event("fee_status_updated", current_user, {
        "student_id": request.student_id,
        "status": fee_status,
        "approval_status": update["fee_status_approval_status"],
    })
    return {"success": True, "status": fee_status, "approval_status": update["fee_status_approval_status"]}


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
            "class_name": request.class_name,

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
        status_value = request.status.value if hasattr(request.status, "value") else str(request.status)
        attendance_day = attendance_date.date().isoformat()
        attendance_week = f"{attendance_date.isocalendar().year}-W{attendance_date.isocalendar().week:02d}"
        await db.attendance_summaries.update_one(
            {
                "school_id": school_id,
                "entity_type": entity_type,
                "entity_id": request.entity_id,
                "date": attendance_day,
                "status": status_value,
                "class_name": request.class_name,
            },
            {
                "$inc": {"count": 1},
                "$set": {
                    "week": attendance_week,
                    "updated_at": now_iso(),
                },
                "$setOnInsert": {
                    "id": str(uuid.uuid4()),
                    "created_at": now_iso(),
                }
            },
            upsert=True
        )
        await log_security_event(
            "attendance_marked",
            current_user,
            {
                "attendance_id": attendance["id"],
                "entity_type": request.entity_type,
                "entity_id": request.entity_id,
                "approval_status": attendance["approval_status"],
            }
        )

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


@api_router.get("/attendance/summary")
async def get_attendance_summary(
    current_user: dict = Depends(get_current_user)
):
    school_id = current_user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=403, detail="Unauthorized")

    role = normalize_role(current_user.get("role"))
    if role not in {"school_admin", "teacher", "secretary", "super_admin"}:
        raise HTTPException(status_code=403, detail="Unauthorized")

    pipeline = [
        {"$match": {"school_id": school_id}},
        {"$group": {
            "_id": {"week": "$week", "status": "$status"},
            "count": {"$sum": "$count"}
        }},
        {"$sort": {"_id.week": -1}},
        {"$limit": 60},
    ]
    weekly = await db.attendance_summaries.aggregate(pipeline).to_list(100)
    totals_pipeline = [
        {"$match": {"school_id": school_id}},
        {"$group": {"_id": "$status", "count": {"$sum": "$count"}}},
    ]
    totals = await db.attendance_summaries.aggregate(totals_pipeline).to_list(20)

    return {
        "totals": {str(row["_id"]): row["count"] for row in totals},
        "weekly": [
            {
                "week": row["_id"]["week"],
                "status": row["_id"]["status"],
                "count": row["count"],
            }
            for row in weekly
        ],
        "retention_policy": {
            "detail_window_months": 4,
            "summary_retention": "permanent"
        }
    }


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
            "school_id": school_id,
            "archived": {"$ne": True}
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

@api_router.post("/attendance/archive-old")
async def archive_old_attendance(current_user: dict = Depends(get_current_user)):
    school_id = current_user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=403, detail="No school assigned")

    role = normalize_role(current_user.get("role"))
    if role not in {"school_admin", "super_admin"}:
        raise HTTPException(status_code=403, detail="Unauthorized")

    cutoff = datetime.now(timezone.utc) - timedelta(days=122)
    result = await db.attendance.update_many(
        {
            "school_id": school_id,
            "archived": {"$ne": True},
            "date": {"$lt": cutoff.isoformat()},
        },
        {"$set": {
            "archived": True,
            "archived_at": now_iso(),
            "archive_reason": "older_than_4_months",
            "updated_at": now_iso(),
        }}
    )
    await log_security_event("attendance_archived", current_user, {
        "cutoff": cutoff.isoformat(),
        "archived_count": result.modified_count,
    })
    return {"success": True, "archived_count": result.modified_count, "cutoff": cutoff.isoformat()}


@api_router.get("/exams")
async def get_exams(
    current_user: dict = Depends(get_current_user)
):
    school_id = current_user.get("school_id")

    if not school_id:
        raise HTTPException(status_code=403, detail="No school assigned")

    role = normalize_role(current_user.get("role"))

    if role not in ["school_admin", "teacher", "student", "parent", "super_admin"]:
        raise HTTPException(status_code=403, detail="Unauthorized")

    exams = await db.exams.find(
        {"school_id": school_id},
        {"_id": 0}
    ).sort("exam_date", -1).to_list(length=1000)

    return api_success(serialize_docs(exams), count=len(exams))


@api_router.post("/exams")
async def create_exam(
    request: CreateExamRequest,
    current_user: dict = Depends(get_current_user)
):
    school_id = current_user.get("school_id")

    if not school_id:
        raise HTTPException(status_code=403, detail="No school assigned")

    role = normalize_role(current_user.get("role"))

    if role not in ["school_admin", "teacher", "super_admin"]:
        raise HTTPException(status_code=403, detail="Unauthorized")

    try:
        exam_date = datetime.fromisoformat(request.exam_date)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid exam date")

    existing = await db.exams.find_one({
        "school_id": school_id,
        "name": request.name,
        "term": request.term,
        "exam_number": request.exam_number,
        "academic_year": request.academic_year,
        "class_name": request.class_name,
        "year_of_study": request.year_of_study
    })

    if existing:
        raise HTTPException(status_code=400, detail="Exam already exists")

    exam = {
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "name": request.name,
        "class_name": request.class_name,
        "year_of_study": request.year_of_study,
        "term": request.term,
        "exam_number": request.exam_number,
        "academic_year": request.academic_year,
        "exam_date": exam_date,
        "created_by": current_user.get("user_id"),
        "created_at": now_utc(),
        "updated_at": now_utc()
    }

    await db.exams.insert_one(exam)
    await log_security_event(
        "exam_created",
        current_user,
        {
            "exam_id": exam["id"],
            "class_name": exam.get("class_name"),
            "term": exam.get("term"),
            "academic_year": exam.get("academic_year"),
        }
    )

    return api_success(
        serialize_doc(exam),
        message="Exam created successfully",
        exam_id=exam["id"]
    )


# OLD LOGIN - DISABLED
# @api_router.post("/auth/login")
async def _disabled_legacy_login_v1(request: LoginRequest):
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
async def _disabled_legacy_login_v2(request: LoginRequest):
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
            grade_value = str(request.grade or "").upper().strip()
            grade_aliases = {
                "EE": "EE1",
                "ME": "ME1",
                "AE": "AE1",
                "BE": "BE1"
            }
            grade = CBEGrade(grade_aliases.get(grade_value, grade_value))
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
        result_dict.update({
            "report_url": request.report_url,
            "result_type": str(request.result_type or "exam").strip().lower(),
            "term": request.term or exam.get("term"),
            "class_name": student.get("class_name") or exam.get("class_name"),
            "student_name": student.get("full_name"),
            "admission_number": student.get("admission_number"),
            "visible_to_student": bool(auto_approve),
        })

        await db.results.insert_one(result_dict)
        await log_security_event(
            "result_recorded",
            current_user,
            {
                "result_id": result_dict["id"],
                "exam_id": request.exam_id,
                "student_id": request.student_id,
                "subject": request.subject,
                "result_type": result_dict["result_type"],
                "approval_status": result_dict["approval_status"],
            }
        )

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

        if not can_view_all:
            user_id = current_user.get("user_id") or current_user.get("id")
            student_id = current_user.get("student_id")
            admission_number = current_user.get("admission_number")
            filtered = []
            for announcement in announcements:
                audience = str(announcement.get("target_audience") or "all").lower()
                student_targets = [str(v) for v in announcement.get("target_student_ids") or []]
                staff_targets = [str(v) for v in announcement.get("target_staff_user_ids") or []]
                if audience == "all":
                    filtered.append(announcement)
                elif role == "student" and audience in ["students", "specific_students"]:
                    if audience == "students" or str(student_id) in student_targets or str(admission_number) in student_targets:
                        filtered.append(announcement)
                elif role == "parent" and audience in ["parents", "specific_students"]:
                    if audience == "parents" or str(student_id) in student_targets or str(admission_number) in student_targets:
                        filtered.append(announcement)
                elif role in ["teacher", "finance", "secretary"] and audience in ["staff", "specific_staff"]:
                    if audience == "staff" or str(user_id) in staff_targets:
                        filtered.append(announcement)
            announcements = filtered

        return announcements

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Get announcements error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/announcements")
async def create_announcement(
    request: CreateAnnouncementRequest,
    current_user: dict = Depends(get_current_user)
):
    try:
        school_id = current_user.get("school_id")

        if not school_id:
            raise HTTPException(status_code=403, detail="Unauthorized")

        role = normalize_role(current_user.get("role"))

        if role not in ["school_admin", "secretary", "teacher", "finance", "super_admin"]:
            raise HTTPException(status_code=403, detail="Unauthorized")

        allowed_audiences = {
            "all",
            "students",
            "parents",
            "staff",
            "class",
            "specific_students",
            "specific_staff",
        }
        target_audience = str(request.target_audience or "all").lower().strip()
        if target_audience not in allowed_audiences:
            raise HTTPException(status_code=400, detail="Invalid target audience")

        auto_approve = role in ["school_admin", "super_admin"]
        user_id = current_user.get("user_id")
        now = now_utc()

        announcement = {
            "id": str(uuid.uuid4()),
            "school_id": school_id,
            "title": request.title,
            "content": request.content,
            "target_audience": target_audience,
            "target_class": request.target_class,
            "target_student_ids": [str(v).strip() for v in (request.target_student_ids or []) if str(v).strip()],
            "target_staff_user_ids": [str(v).strip() for v in (request.target_staff_user_ids or []) if str(v).strip()],
            "priority": request.priority or "normal",
            "created_by": user_id,
            "submitted_by": user_id,
            "approval_status": "approved" if auto_approve else "pending",
            "approved_by": user_id if auto_approve else None,
            "approval_date": now if auto_approve else None,
            "created_at": now,
            "updated_at": now
        }

        await db.announcements.insert_one(announcement)
        await log_security_event(
            "announcement_created",
            current_user,
            {
                "announcement_id": announcement["id"],
                "target_audience": announcement["target_audience"],
                "approval_status": announcement["approval_status"],
            }
        )

        if announcement["approval_status"] == "pending":
            await db.approvals.insert_one({
                "id": str(uuid.uuid4()),
                "type": "announcement",
                "item_id": announcement["id"],
                "school_id": school_id,
                "status": "pending",
                "submitted_by": user_id,
                "created_at": now
            })

        return api_success(
            serialize_doc(announcement),
            message="Announcement submitted",
            announcement_id=announcement["id"],
            approval_status=announcement["approval_status"]
        )

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Create announcement error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


# =========================================================
# ADMIN APPROVAL QUEUE (FIXED CONSISTENCY)
# =========================================================

async def _legacy_get_all_pending(current_user: dict = Depends(get_current_user)):

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
        await log_security_event(
            "finance_approval_requested",
            current_user,
            {"request_id": approval_request["id"], "request_type": request_type}
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

async def _legacy_update_student(
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
        await db.audit_logs.insert_one({
            "action": "mpesa_callback_received",
            "performed_by": "mpesa_callback",
            "user_id": None,
            "school_id": None,
            "metadata": {
                "merchant_request_id": merchant_request_id,
                "checkout_request_id": checkout_request_id,
                "result_code": result_code,
            },
            "timestamp": now_iso()
        })

    return {"ResultCode": 0, "ResultDesc": "Success"}

# ─────────────────────────────────────────────
# STUDENT PORTAL DATA (FULL FIXED FLOW)
# ─────────────────────────────────────────────

@api_router.get("/portal/my-data")
async def get_my_portal_data(
    selected_student_id: Optional[str] = None,
    admission_number: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    try:

        school_id = current_user.get("school_id")
        user_id = current_user.get("user_id")
        email = current_user.get("email")
        linked_student_id = current_user.get("student_id")
        linked_admission_number = current_user.get("admission_number")
        linked_access_code = current_user.get("student_access_code")

        if not school_id:
            raise HTTPException(status_code=403, detail="No school assigned")

        # =========================
        # STUDENT LINKING (APPROVED ONLY)
        # Parent accounts can manage multiple children, but every child
        # remains a separate record and query scope.
        # =========================
        child_scope = [
            {"submitted_by": user_id}
        ]
        if linked_student_id:
            child_scope.append({"id": linked_student_id})
        if linked_admission_number:
            child_scope.append({"admission_number": linked_admission_number})
        if linked_access_code:
            child_scope.append({"student_access_code": linked_access_code})

        child_query = {
            "school_id": school_id,
            "approval_status": "approved",
            "$or": child_scope
        }

        if email:
            child_query["$or"].extend([
                {"guardian_email": email},
                {"secondary_guardian_email": email}
            ])

        children = await db.students.find(
            child_query,
            {"_id": 0}
        ).sort("full_name", 1).to_list(100)

        if admission_number:
            admission_number = admission_number.strip()
            children = [
                child for child in children
                if str(child.get("admission_number") or "").lower() == admission_number.lower()
            ]

        student = None

        if selected_student_id:
            student = next(
                (child for child in children if child.get("id") == selected_student_id),
                None
            )

        if not student and children:
            student = children[0]

        if not student:
            return {
                "student": None,
                "children": [],
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
                    "approval_status": "approved",
                    "archived": {"$ne": True}
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
                    "approval_status": "approved",
                    "archived": {"$ne": True}
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
                "approval_status": "approved",
                "visible_to_student": True
            },
            {"_id": 0}
        ).sort("created_at", -1).to_list(500)

        school = await db.schools.find_one(
            {"id": school_id},
            {"_id": 0}
        )

        for payment in payments:
            payment["school_name"] = school.get("name") if school else None
            payment["school_code"] = school.get("school_code") if school else None
            payment["school_logo"] = (school.get("logo_url") or school.get("logo")) if school else None
            payment["school_stamp"] = school.get("stamp_url") if school else None
            payment["student_name"] = student.get("full_name")
            payment["admission_number"] = student.get("admission_number")
            payment["received_from"] = payment.get("received_from") or student.get("guardian_name") or student.get("secondary_guardian_name")
            payment["payment_breakdown"] = receipt_breakdown(payment)
            payment["receipt_layout"] = {
                "title": "SMART M HUB - SCHOOL PAYMENT RECEIPT",
                "school_logo": payment["school_logo"],
                "school_name": payment["school_name"],
                "school_code": payment["school_code"],
                "receipt_number": payment.get("receipt_number"),
                "receipt_date": payment.get("approval_date") or payment.get("created_at"),
                "student_name": payment["student_name"],
                "admission_number": payment["admission_number"],
                "received_from": payment["received_from"],
                "payment_method": payment.get("payment_method"),
                "transaction_reference": payment.get("transaction_reference") or payment.get("bank_reference") or payment.get("cheque_number"),
                "payment_breakdown": payment["payment_breakdown"],
                "total_amount_due": payment.get("total_amount_due"),
                "total_paid": payment.get("total_paid") or payment.get("amount"),
                "outstanding_balance": payment.get("outstanding_balance"),
                "received_by": payment.get("submitted_by"),
                "approved_by": payment.get("approved_by"),
                "official_school_stamp": payment["school_stamp"],
            }

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

        visible_announcements = []
        for announcement in announcements:
            audience = str(announcement.get("target_audience") or "all").lower()
            target_class = announcement.get("target_class")
            student_targets = [str(v) for v in announcement.get("target_student_ids") or []]
            if audience in ["all", "students", "parents"]:
                visible_announcements.append(announcement)
            elif audience == "specific_students" and (
                str(student.get("id")) in student_targets or
                str(student.get("admission_number")) in student_targets
            ):
                visible_announcements.append(announcement)
            elif target_class and target_class == student.get("class_name"):
                visible_announcements.append(announcement)

        return {
            "student": student,
            "children": children,
            "results": results,
            "exams": [r for r in results if str(r.get("result_type") or "exam") == "exam"],
            "assessments": [r for r in results if str(r.get("result_type") or "") == "assessment"],
            "attendance": attendance_records,
            "payments": payments,
            "announcements": visible_announcements,
            "fee_balance": fee_balance,
            "fee_status": student.get("fee_status") if student.get("fee_status_visible") else None,
            "fee_status_note": student.get("fee_status_note") if student.get("fee_status_visible") else None
        }

    except Exception as e:
        logger.error(f"Portal data error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


# ─────────────────────────────────────────────
# FINANCE TRANSACTIONS (FIXED + CONSISTENT)
# ─────────────────────────────────────────────

@api_router.get("/support-tickets")
async def get_school_support_tickets(current_user: dict = Depends(get_current_user)):
    school_id = current_user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=403, detail="No school assigned")

    role = normalize_role(current_user.get("role"))
    if role not in ["school_admin", "teacher", "finance", "secretary", "student", "parent"]:
        raise HTTPException(status_code=403, detail="Unauthorized")

    tickets = await db.support_tickets.find(
        {"school_id": school_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    return tickets


@api_router.post("/support-tickets")
async def create_school_support_ticket(
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    school_id = current_user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=403, detail="No school assigned")

    role = normalize_role(current_user.get("role"))
    if role not in ["school_admin", "teacher", "finance", "secretary", "student", "parent"]:
        raise HTTPException(status_code=403, detail="Unauthorized")

    subject = str(data.get("subject") or "").strip()
    message = str(data.get("message") or "").strip()
    if not subject or not message:
        raise HTTPException(status_code=400, detail="Subject and message are required")

    ticket = {
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "subject": subject,
        "message": message,
        "priority": data.get("priority") or "normal",
        "status": "open",
        "created_by": current_user.get("user_id") or current_user.get("id"),
        "created_by_email": current_user.get("email"),
        "replies": [],
        "internal_notes": [],
        "resolution_history": [],
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.support_tickets.insert_one(ticket)
    await log_security_event("support_ticket_created", current_user, {"ticket_id": ticket["id"], "priority": ticket["priority"]})
    return {"success": True, "message": "Support ticket created", "ticket": serialize_doc(ticket)}


@api_router.patch("/support-tickets/{ticket_id}")
async def update_school_support_ticket(
    ticket_id: str,
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    school_id = current_user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=403, detail="No school assigned")

    ticket = await db.support_tickets.find_one({"id": ticket_id, "school_id": school_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Support ticket not found")

    update = {"updated_at": now_iso()}
    if data.get("status") in ["open", "closed", "resolved"]:
        update["status"] = data["status"]

    operation = {"$set": update}
    if data.get("reply"):
        operation["$push"] = {
            "replies": {
                "message": data["reply"],
                "by": current_user.get("email"),
                "created_at": now_iso(),
            }
        }

    await db.support_tickets.update_one({"id": ticket_id, "school_id": school_id}, operation)
    await log_security_event("support_ticket_updated", current_user, {"ticket_id": ticket_id, "status": update.get("status")})
    return {"success": True, "message": "Support ticket updated"}


@api_router.get("/platform-announcements")
async def get_platform_announcements(current_user: dict = Depends(get_current_user)):
    school_id = current_user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=403, detail="No school assigned")

    announcements = await db.global_announcements.find(
        {"status": "active"},
        {"_id": 0}
    ).sort("created_at", -1).limit(10).to_list(10)
    return announcements


@api_router.get("/support-notices")
async def get_support_notices(current_user: dict = Depends(get_current_user)):
    school_id = current_user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=403, detail="No school assigned")
    role = normalize_role(current_user.get("role"))
    if role not in {"school_admin", "secretary", "finance"}:
        raise HTTPException(status_code=403, detail="Unauthorized")
    user_id = current_user.get("user_id") or current_user.get("id")
    notices = await db.support_notices.find(
        {"school_id": school_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    for notice in notices:
        notice["is_read"] = user_id in (notice.get("read_by") or [])
    return {"success": True, "data": notices}


@api_router.patch("/support-notices/{notice_id}/read")
async def mark_support_notice_read(
    notice_id: str,
    current_user: dict = Depends(get_current_user)
):
    school_id = current_user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=403, detail="No school assigned")
    role = normalize_role(current_user.get("role"))
    if role not in {"school_admin", "secretary", "finance"}:
        raise HTTPException(status_code=403, detail="Unauthorized")
    user_id = current_user.get("user_id") or current_user.get("id")
    result = await db.support_notices.update_one(
        {"id": notice_id, "school_id": school_id},
        {"$addToSet": {"read_by": user_id}, "$set": {"updated_at": now_iso()}}
    )
    if not result.matched_count:
        raise HTTPException(status_code=404, detail="Support notice not found")
    await log_security_event("support_notice_read", current_user, {"notice_id": notice_id})
    return {"success": True, "message": "Notice marked read"}


@api_router.get("/timetable")
async def get_timetable(current_user: dict = Depends(get_current_user)):
    school_id = current_user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=403, detail="No school assigned")

    role = normalize_role(current_user.get("role"))
    if role not in ["school_admin", "teacher", "secretary", "student"]:
        raise HTTPException(status_code=403, detail="Unauthorized")

    return await db.timetable.find(
        {"school_id": school_id},
        {"_id": 0}
    ).sort([("class_name", 1), ("day_order", 1), ("time", 1)]).to_list(1000)


@api_router.post("/timetable")
async def create_timetable_entry(
    request: CreateTimetableRequest,
    current_user: dict = Depends(get_current_user)
):
    school_id = current_user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=403, detail="No school assigned")

    role = normalize_role(current_user.get("role"))
    if role not in ["school_admin", "teacher", "secretary"]:
        raise HTTPException(status_code=403, detail="Unauthorized")

    day_order = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    day_key = request.day.strip().lower()
    record = {
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "class_name": request.class_name.strip(),
        "day": request.day.strip(),
        "day_order": day_order.index(day_key) if day_key in day_order else 99,
        "subject": request.subject.strip(),
        "time": request.time.strip(),
        "teacher_name": request.teacher_name,
        "room": request.room,
        "document_url": request.document_url,
        "version": 1,
        "version_history": [],
        "created_by": current_user.get("user_id") or current_user.get("id"),
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }

    if not record["class_name"] or not record["day"] or not record["subject"] or not record["time"]:
        raise HTTPException(status_code=400, detail="Class, day, subject and time are required")

    await db.timetable.insert_one(record)
    await log_security_event("timetable_entry_created", current_user, {"timetable_id": record["id"], "class_name": record["class_name"]})
    return {"success": True, "message": "Timetable entry saved", "entry": serialize_doc(record)}


@api_router.patch("/timetable/{entry_id}")
async def update_timetable_entry(
    entry_id: str,
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    school_id = current_user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=403, detail="No school assigned")

    role = normalize_role(current_user.get("role"))
    if role not in ["school_admin", "teacher", "secretary"]:
        raise HTTPException(status_code=403, detail="Unauthorized")

    existing = await db.timetable.find_one({"id": entry_id, "school_id": school_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Timetable entry not found")

    allowed = ["class_name", "day", "subject", "time", "teacher_name", "room", "document_url"]
    update = {key: data[key] for key in allowed if key in data}
    if "day" in update:
        day_order = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
        day_key = str(update["day"]).strip().lower()
        update["day_order"] = day_order.index(day_key) if day_key in day_order else 99

    update["version"] = int(existing.get("version") or 1) + 1
    update["updated_at"] = now_iso()
    update["updated_by"] = current_user.get("user_id") or current_user.get("id")

    history = serialize_doc({key: existing.get(key) for key in allowed + ["version", "updated_at"]})
    await db.timetable.update_one(
        {"id": entry_id, "school_id": school_id},
        {"$set": update, "$push": {"version_history": history}}
    )
    await log_security_event("timetable_entry_updated", current_user, {"timetable_id": entry_id})
    return {"success": True, "message": "Timetable entry updated"}


@api_router.get("/inventory")
async def get_inventory(current_user: dict = Depends(get_current_user)):
    school_id = current_user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=403, detail="No school assigned")

    role = normalize_role(current_user.get("role"))
    if role not in ["school_admin", "secretary"]:
        raise HTTPException(status_code=403, detail="Unauthorized")

    return await db.inventory.find(
        {"school_id": school_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)


@api_router.post("/inventory")
async def create_inventory_item(
    request: CreateInventoryItemRequest,
    current_user: dict = Depends(get_current_user)
):
    school_id = current_user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=403, detail="No school assigned")

    role = normalize_role(current_user.get("role"))
    if role not in ["school_admin", "secretary"]:
        raise HTTPException(status_code=403, detail="Unauthorized")

    if request.quantity < 0:
        raise HTTPException(status_code=400, detail="Quantity cannot be negative")

    record = {
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "name": request.name.strip(),
        "quantity": request.quantity,
        "category": request.category,
        "location": request.location,
        "condition": request.condition,
        "reorder_level": request.reorder_level or 0,
        "notes": request.notes,
        "history": [],
        "created_by": current_user.get("user_id") or current_user.get("id"),
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }

    if not record["name"]:
        raise HTTPException(status_code=400, detail="Item name is required")

    await db.inventory.insert_one(record)
    await log_security_event("inventory_item_created", current_user, {"inventory_id": record["id"], "name": record["name"]})
    return {"success": True, "message": "Inventory item saved", "item": serialize_doc(record)}


@api_router.patch("/inventory/{item_id}")
async def update_inventory_item(
    item_id: str,
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    school_id = current_user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=403, detail="No school assigned")

    role = normalize_role(current_user.get("role"))
    if role not in ["school_admin", "secretary"]:
        raise HTTPException(status_code=403, detail="Unauthorized")

    existing = await db.inventory.find_one({"id": item_id, "school_id": school_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Inventory item not found")

    allowed = ["name", "quantity", "category", "location", "condition", "reorder_level", "notes"]
    update = {key: data[key] for key in allowed if key in data}
    if "quantity" in update and int(update["quantity"]) < 0:
        raise HTTPException(status_code=400, detail="Quantity cannot be negative")
    update["updated_at"] = now_iso()
    update["updated_by"] = current_user.get("user_id") or current_user.get("id")

    history = {
        "action": "updated",
        "before": serialize_doc({key: existing.get(key) for key in allowed}),
        "after": update,
        "by": update["updated_by"],
        "timestamp": update["updated_at"],
    }
    await db.inventory.update_one(
        {"id": item_id, "school_id": school_id},
        {"$set": update, "$push": {"history": history}}
    )
    await log_security_event("inventory_item_updated", current_user, {"inventory_id": item_id})
    return {"success": True, "message": "Inventory item updated"}


@api_router.get("/finance/fee-structures")
async def get_fee_structures(current_user: dict = Depends(get_current_user)):
    school_id = current_user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=403, detail="No school assigned")

    role = normalize_role(current_user.get("role"))
    if role not in ["school_admin", "finance", "secretary"]:
        raise HTTPException(status_code=403, detail="Unauthorized")

    return await db.fee_structures.find(
        {"school_id": school_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)


@api_router.post("/finance/fee-structures")
async def create_fee_structure(
    request: CreateFeeStructureRequest,
    current_user: dict = Depends(get_current_user)
):
    school_id = current_user.get("school_id")
    if not school_id:
        raise HTTPException(status_code=403, detail="No school assigned")

    role = normalize_role(current_user.get("role"))
    if role not in ["school_admin", "finance"]:
        raise HTTPException(status_code=403, detail="Unauthorized")

    if request.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")

    record = {
        "id": str(uuid.uuid4()),
        "school_id": school_id,
        "class_name": request.class_name.strip(),
        "term": request.term,
        "academic_year": request.academic_year,
        "amount": request.amount,
        "description": request.description,
        "document_url": request.document_url,
        "created_by": current_user.get("user_id") or current_user.get("id"),
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }

    if not record["class_name"]:
        raise HTTPException(status_code=400, detail="Class name is required")

    await db.fee_structures.insert_one(record)
    await log_security_event(
        "fee_structure_created",
        current_user,
        {
            "fee_structure_id": record["id"],
            "class_name": record["class_name"],
            "amount": record["amount"],
        }
    )

    return {
        "success": True,
        "message": "Fee structure created",
        "fee_structure": serialize_doc(record)
    }


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
        await log_security_event(
            "finance_transaction_recorded",
            current_user,
            {
                "transaction_id": txn["id"],
                "transaction_type": txn["transaction_type"],
                "category": txn["category"],
                "amount": txn["amount"],
                "approval_status": txn["approval_status"],
            }
        )

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
        role = normalize_role(current_user.get("role"))

        if role != "school_admin":
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

        await log_security_event(
            "student_progression_completed",
            current_user,
            {
                "academic_year": request.academic_year,
                "from_class": request.from_class,
                "progressed": progressed,
                "graduated": graduated,
                "total_processed": progressed + graduated,
            }
        )

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
        role = normalize_role(current_user.get("role"))

        allowed_roles = [
            "school_admin",
            "teacher",
            "secretary"
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

async def ensure_database_indexes():
    index_specs = [
        (db.schools, [("school_code", 1)], {"unique": True, "sparse": True, "name": "unique_school_code"}),
        (db.schools, [("id", 1)], {"name": "school_id_idx"}),
        (db.users, [("school_id", 1), ("email", 1)], {"name": "users_school_email_idx"}),
        (db.users, [("id", 1)], {"name": "users_id_idx"}),
        (db.students, [("school_id", 1), ("admission_number", 1)], {"name": "students_school_admission_idx"}),
        (db.students, [("school_id", 1), ("id", 1)], {"name": "students_school_id_idx"}),
        (db.staff, [("school_id", 1), ("employee_number", 1)], {"name": "staff_school_employee_idx"}),
        (db.payments, [("school_id", 1), ("created_at", -1)], {"name": "payments_school_created_idx"}),
        (db.attendance, [("school_id", 1), ("date", -1)], {"name": "attendance_school_date_idx"}),
        (db.attendance_summaries, [("school_id", 1), ("week", -1), ("status", 1)], {"name": "attendance_summary_school_week_status_idx"}),
        (db.results, [("school_id", 1), ("student_id", 1)], {"name": "results_school_student_idx"}),
        (db.announcements, [("school_id", 1), ("approval_status", 1)], {"name": "announcements_school_approval_idx"}),
        (db.support_tickets, [("school_id", 1), ("status", 1), ("created_at", -1)], {"name": "support_school_status_created_idx"}),
        (db.audit_logs, [("school_id", 1), ("timestamp", -1)], {"name": "audit_school_timestamp_idx"}),
        (db.login_attempts, [("key", 1)], {"unique": True, "name": "login_attempt_key_idx"}),
        (db.platform_invoices, [("school_id", 1), ("invoice_type", 1), ("billing_month", 1)], {"name": "invoices_school_type_month_idx"}),
        (db.platform_invoices, [("status", 1), ("due_date", 1)], {"name": "invoices_status_due_date_idx"}),
        (db.subscription_reminders, [("school_id", 1), ("billing_month", 1), ("reminder_type", 1)], {"name": "reminders_school_month_type_idx"}),
        (db.fee_structures, [("school_id", 1), ("class_name", 1)], {"name": "fee_structures_school_class_idx"}),
        (db.timetable, [("school_id", 1), ("class_name", 1), ("day_order", 1)], {"name": "timetable_school_class_day_idx"}),
        (db.inventory, [("school_id", 1), ("category", 1)], {"name": "inventory_school_category_idx"}),
    ]

    for collection, keys, options in index_specs:
        try:
            await collection.create_index(keys, **options)
        except Exception as exc:
            logger.warning("Index creation skipped for %s: %s", collection.name, exc)


@app.on_event("startup")
async def startup_tasks():
    await ensure_database_indexes()


app.include_router(api_router)


# =========================
# FIX: MODERN FASTAPI SHUTDOWN HANDLER
# =========================
@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
