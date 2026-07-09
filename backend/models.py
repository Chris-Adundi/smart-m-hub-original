from pydantic import BaseModel, Field, ConfigDict, EmailStr, model_validator
from typing import Optional, List
from datetime import datetime, timezone
from enum import Enum
import uuid


# =========================
# ENUMS
# =========================

class UserRole(str, Enum):
    SUPER_ADMIN = "super_admin"
    SCHOOL_ADMIN = "school_admin"
    TEACHER = "teacher"
    FINANCE = "finance"
    SECRETARY = "secretary"
    SUPPORTING_STAFF = "supporting_staff"
    PARENT = "parent"
    STUDENT = "student"


class ApprovalStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class SubscriptionStatus(str, Enum):
    INACTIVE = "inactive"
    ACTIVE = "active"
    TRIAL = "trial"
    EXPIRED = "expired"
    SUSPENDED = "suspended"


class PaymentStatus(str, Enum):
    PENDING = "pending"
    PAID = "paid"
    APPROVED = "approved"
    COMPLETED = "completed"
    OVERDUE = "overdue"
    FAILED = "failed"


class AttendanceStatus(str, Enum):
    PRESENT = "present"
    ABSENT = "absent"
    LATE = "late"
    EXCUSED = "excused"


class StudentStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    GRADUATED = "graduated"
    SUSPENDED = "suspended"


class SchoolType(str, Enum):
    PRIMARY = "primary"
    JUNIOR_SECONDARY = "junior_secondary"
    SENIOR_SECONDARY = "senior_secondary"
    SECONDARY = "secondary"
    COLLEGE = "college"
    UNIVERSITY = "university"
    OTHER = "other"


class PaymentMethod(str, Enum):
    MPESA = "mpesa"
    CASH = "cash"
    BANK_TRANSFER = "bank_transfer"
    CHEQUE = "cheque"


class CBEGrade(str, Enum):
    EE1 = "EE1"
    EE2 = "EE2"
    ME1 = "ME1"
    ME2 = "ME2"
    AE1 = "AE1"
    AE2 = "AE2"
    BE1 = "BE1"
    BE2 = "BE2"


# =========================
# BASE UTILS
# =========================

def now_utc():
    return datetime.now(timezone.utc)


def gen_id():
    return str(uuid.uuid4())


# =========================
# ROLE NORMALIZATION HELPER (FIXED SAFETY)
# =========================
def normalize_role_value(role) -> str:
    if not role:
        return ""
    return str(role).strip().lower().replace(" ", "_")


# =========================
# SCHOOL
# =========================

class School(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=gen_id)
    name: str
    address: str
    phone: str
    email: EmailStr
    school_type: Optional[SchoolType] = None
    school_classification: Optional[str] = None
    operation_type: str = "day"
    boarding_enabled: bool = False

    password_hash: Optional[str] = None

    invite_code: str = Field(default_factory=lambda: str(uuid.uuid4())[:8].upper())
    school_code: Optional[str] = None
    slug: Optional[str] = None
    invite_link: Optional[str] = None
    login_link: Optional[str] = None

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
    theme: dict = Field(default_factory=lambda: {
        "primary": "#10B981",
        "secondary": "#0F172A"
    })

    status: str = "active"

    subscription_status: SubscriptionStatus = SubscriptionStatus.ACTIVE
    subscription_amount: float = 2000

    active_users_count: int = 0

    created_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)

    @model_validator(mode="after")
    def synchronize_operation_type(self):
        operation_type = str(self.operation_type or "day").lower().strip()
        if operation_type not in {"day", "boarding", "mixed"}:
            raise ValueError("operation_type must be day, boarding, or mixed")
        self.operation_type = operation_type
        self.boarding_enabled = operation_type in {"boarding", "mixed"}
        return self


# =========================
# USER (FIXED: STRING ROLE SAFETY)
# =========================

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=gen_id)
    school_id: Optional[str] = None

    email: EmailStr
    password_hash: str
    full_name: str
    phone: Optional[str] = None

    # FIX: store as STRING to avoid enum mismatch issues
    role: str = "teacher"

    # FIX: string instead of enum to avoid frontend/backend mismatch crashes
    approval_status: str = "pending"

    is_active: bool = True

    created_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)


# =========================
# STUDENT
# =========================

class Student(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=gen_id)
    school_id: str

    admission_number: Optional[str] = None
    full_name: str

    date_of_birth: Optional[datetime] = None
    gender: Optional[str] = None

    class_name: Optional[str] = None
    year_of_study: Optional[str] = None
    stream: Optional[str] = None

    guardian_name: Optional[str] = None
    guardian_phone: Optional[str] = None
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

    status: StudentStatus = StudentStatus.ACTIVE
    approval_status: ApprovalStatus = ApprovalStatus.PENDING

    submitted_by: Optional[str] = None
    approved_by: Optional[str] = None
    approval_date: Optional[datetime] = None

    certificate_collected: bool = False
    certificate_collection_date: Optional[str] = None

    created_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)


# =========================
# STAFF
# =========================

class Staff(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=gen_id)
    school_id: str
    user_id: str

    employee_number: str
    department: str
    position: str
    salary: Optional[float] = None

    joined_date: Optional[datetime] = None

    created_at: datetime = Field(default_factory=now_utc)


# =========================
# PAYMENT
# =========================

class Payment(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=gen_id)
    school_id: str

    student_id: Optional[str] = None
    amount: float

    payment_type: Optional[str] = None
    payment_method: PaymentMethod = PaymentMethod.MPESA

    phone_number: Optional[str] = None
    bank_reference: Optional[str] = None
    cheque_number: Optional[str] = None
    description: Optional[str] = None

    status: PaymentStatus = PaymentStatus.PENDING
    approval_status: ApprovalStatus = ApprovalStatus.PENDING

    receipt_number: str = Field(default_factory=lambda: str(uuid.uuid4())[:10].upper())

    submitted_by: Optional[str] = None
    approved_by: Optional[str] = None
    approval_date: Optional[datetime] = None

    completed_at: Optional[datetime] = None

    created_at: datetime = Field(default_factory=now_utc)


# =========================
# ATTENDANCE
# =========================

class Attendance(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=gen_id)
    school_id: str

    student_id: Optional[str] = None
    class_name: Optional[str] = None

    date: datetime

    status: AttendanceStatus = AttendanceStatus.PRESENT

    marked_by: Optional[str] = None
    remarks: Optional[str] = None

    approval_status: ApprovalStatus = ApprovalStatus.PENDING

    created_at: datetime = Field(default_factory=now_utc)


# =========================
# EXAM
# =========================

class Exam(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=gen_id)
    school_id: str

    name: str
    class_name: Optional[str] = None
    year_of_study: Optional[str] = None
    term: str
    exam_number: str
    academic_year: str

    exam_date: datetime

    created_at: datetime = Field(default_factory=now_utc)


# =========================
# RESULT
# =========================

class Result(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=gen_id)
    school_id: str

    exam_id: str
    student_id: str

    subject: str
    marks: float
    grade: CBEGrade

    teacher_comments: Optional[str] = None

    approval_status: ApprovalStatus = ApprovalStatus.PENDING

    submitted_by: Optional[str] = None
    approved_by: Optional[str] = None
    approval_date: Optional[datetime] = None

    created_at: datetime = Field(default_factory=now_utc)


# =========================
# ANNOUNCEMENT
# =========================

class Announcement(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=gen_id)
    school_id: str

    title: str
    content: str

    target_audience: str
    target_class: Optional[str] = None
    priority: str = "normal"

    created_by: Optional[str] = None

    approval_status: ApprovalStatus = ApprovalStatus.PENDING

    submitted_by: Optional[str] = None
    approved_by: Optional[str] = None
    approval_date: Optional[datetime] = None

    created_at: datetime = Field(default_factory=now_utc)


# =========================
# FEE STRUCTURE
# =========================

class FeeStructure(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=gen_id)
    school_id: str

    class_name: str
    amount: float

    created_at: datetime = Field(default_factory=now_utc)


# =========================
# TIMETABLE
# =========================

class Timetable(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=gen_id)
    school_id: str

    class_name: Optional[str] = None
    day: Optional[str] = None
    subject: Optional[str] = None
    time: Optional[str] = None


# =========================
# INVENTORY
# =========================

class InventoryItem(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=gen_id)
    school_id: str

    name: str
    quantity: int = 0
    category: Optional[str] = None

    created_at: datetime = Field(default_factory=now_utc)
