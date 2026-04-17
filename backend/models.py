from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import Optional, List
from datetime import datetime, timezone
from enum import Enum
import uuid


class UserRole(str, Enum):
    SUPER_ADMIN = "super_admin"
    SCHOOL_ADMIN = "school_admin"
    TEACHER = "teacher"
    FINANCE = "finance"
    SECRETARY = "secretary"
    PARENT = "parent"
    STUDENT = "student"


class ApprovalStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class SubscriptionStatus(str, Enum):
    INACTIVE = "inactive"
    ACTIVE = "active"
    SUSPENDED = "suspended"


class PaymentStatus(str, Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class PaymentMethod(str, Enum):
    MPESA = "mpesa"
    BANK_TRANSFER = "bank_transfer"
    CASH = "cash"
    CHEQUE = "cheque"


class AttendanceStatus(str, Enum):
    PRESENT = "present"
    ABSENT = "absent"
    LATE = "late"
    EXCUSED = "excused"
    SICK_LEAVE = "sick_leave"


class StudentStatus(str, Enum):
    ACTIVE = "active"
    GRADUATED = "graduated"
    DEFERRED = "deferred"
    TRANSFERRED = "transferred"
    SUSPENDED = "suspended"
    EXPELLED = "expelled"


class CBEGrade(str, Enum):
    EE = "EE"  # Exceeding Expectations
    ME = "ME"  # Meeting Expectations
    AE = "AE"  # Approaching Expectations
    BE = "BE"  # Below Expectations


class SchoolType(str, Enum):
    PRIMARY = "primary"
    JUNIOR_SECONDARY = "junior_secondary"
    SENIOR_SECONDARY = "senior_secondary"
    COLLEGE = "college"
    UNIVERSITY = "university"


class School(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    logo_url: Optional[str] = None
    stamp_url: Optional[str] = None
    address: str
    phone: str
    email: EmailStr
    school_type: SchoolType
    motto: Optional[str] = None
    vision: Optional[str] = None
    mission: Optional[str] = None
    principal_name: Optional[str] = None
    website: Optional[str] = None
    established_year: Optional[str] = None
    subscription_status: SubscriptionStatus = SubscriptionStatus.INACTIVE
    installation_fee_paid: bool = False
    installation_paid_at: Optional[datetime] = None
    active_users_count: int = 0
    monthly_billing_date: Optional[datetime] = None
    next_billing_date: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    school_id: Optional[str] = None
    email: EmailStr
    password_hash: str
    full_name: str
    phone: str
    role: UserRole
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Student(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    school_id: str
    admission_number: str
    full_name: str
    date_of_birth: datetime
    gender: str
    class_name: Optional[str] = None
    year_of_study: Optional[str] = None
    stream: Optional[str] = None

    # Primary Guardian
    guardian_name: str
    guardian_phone: str
    guardian_email: Optional[EmailStr] = None
    guardian_relationship: Optional[str] = None

    # Secondary Guardian
    secondary_guardian_name: Optional[str] = None
    secondary_guardian_phone: Optional[str] = None
    secondary_guardian_email: Optional[EmailStr] = None
    secondary_guardian_relationship: Optional[str] = None

    # Extended Health Info
    blood_type: Optional[str] = None
    allergies: Optional[str] = None
    chronic_conditions: Optional[str] = None
    disabilities: Optional[str] = None
    immunization_status: Optional[str] = None
    medical_info: Optional[str] = None

    status: StudentStatus = StudentStatus.ACTIVE
    student_user_id: Optional[str] = None
    certificate_collected: bool = False
    certificate_collection_date: Optional[datetime] = None
    certificate_available: bool = False
    status_changed_at: Optional[datetime] = None
    status_reason: Optional[str] = None

    # Approval workflow
    approval_status: ApprovalStatus = ApprovalStatus.PENDING
    submitted_by: Optional[str] = None
    approved_by: Optional[str] = None
    approval_date: Optional[str] = None
    rejection_reason: Optional[str] = None

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Staff(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    school_id: str
    user_id: str
    employee_number: str
    department: str
    position: str
    responsibilities: Optional[str] = None
    salary: Optional[float] = None
    joined_date: datetime
    sick_leave_days: int = 0
    annual_leave_days: int = 0
    leave_balance: int = 21
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class FeeStructure(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    school_id: str
    class_name: Optional[str] = None
    year_of_study: Optional[str] = None
    term: str
    amount: float
    description: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Payment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    school_id: str
    student_id: Optional[str] = None
    amount: float
    payment_type: str
    payment_method: PaymentMethod
    mpesa_checkout_id: Optional[str] = None
    mpesa_receipt: Optional[str] = None
    bank_reference: Optional[str] = None
    cheque_number: Optional[str] = None
    phone_number: Optional[str] = None
    receipt_number: str = Field(default_factory=lambda: f"RCP{str(uuid.uuid4())[:8].upper()}")
    status: PaymentStatus = PaymentStatus.PENDING
    running_balance: Optional[float] = None
    description: Optional[str] = None

    # Approval workflow
    approval_status: ApprovalStatus = ApprovalStatus.PENDING
    submitted_by: Optional[str] = None
    approved_by: Optional[str] = None
    approval_date: Optional[str] = None
    rejection_reason: Optional[str] = None

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None


class Attendance(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    school_id: str
    student_id: Optional[str] = None
    staff_id: Optional[str] = None
    date: datetime
    status: AttendanceStatus
    remarks: Optional[str] = None

    # Approval workflow
    approval_status: ApprovalStatus = ApprovalStatus.PENDING
    submitted_by: Optional[str] = None
    approved_by: Optional[str] = None
    approval_date: Optional[str] = None
    rejection_reason: Optional[str] = None

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Exam(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    school_id: str
    name: str
    class_name: Optional[str] = None
    year_of_study: Optional[str] = None
    term: str
    exam_number: str
    academic_year: str
    exam_date: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Result(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    school_id: str
    exam_id: str
    student_id: str
    subject: str
    marks: float
    max_marks: float = 100
    grade: CBEGrade = CBEGrade.BE
    teacher_comments: Optional[str] = None
    remarks: Optional[str] = None

    # Approval workflow
    approval_status: ApprovalStatus = ApprovalStatus.PENDING
    submitted_by: Optional[str] = None
    approved_by: Optional[str] = None
    approval_date: Optional[str] = None
    rejection_reason: Optional[str] = None

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Announcement(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    school_id: str
    title: str
    content: str
    target_audience: str
    target_class: Optional[str] = None
    priority: str = "normal"
    created_by: str

    # Approval workflow
    approval_status: ApprovalStatus = ApprovalStatus.PENDING
    submitted_by: Optional[str] = None
    approved_by: Optional[str] = None
    approval_date: Optional[str] = None
    rejection_reason: Optional[str] = None

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Timetable(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    school_id: str
    class_name: Optional[str] = None
    year_of_study: Optional[str] = None
    day_of_week: str
    time_slot: str
    subject: str
    teacher_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class InventoryItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    school_id: str
    name: str
    category: str
    quantity: int
    unit: str
    location: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
