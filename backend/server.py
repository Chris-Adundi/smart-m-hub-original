from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime, timezone
import uuid

from models import (
    School, User, Student, Staff, FeeStructure, Payment, Attendance,
    Exam, Result, Timetable, InventoryItem, Announcement,
    UserRole, SubscriptionStatus, PaymentStatus, AttendanceStatus,
    StudentStatus, SchoolType, PaymentMethod, ApprovalStatus, CBEGrade
)
from auth import (
    get_password_hash, verify_password, create_access_token,
    get_current_user, decode_token
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="Smart-M Hub Original API")
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ─── Request Models ───────────────────────────────────────────────

class RegisterSchoolRequest(BaseModel):
    name: str
    address: str
    phone: str
    email: EmailStr
    school_type: str
    admin_name: str
    admin_email: EmailStr
    admin_phone: str
    admin_password: str


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
    action: str  # "approved" or "rejected"
    reason: Optional[str] = None


class CreateTransactionRequest(BaseModel):
    transaction_type: str  # "income" or "expenditure"
    category: str
    amount: float
    description: str
    date: Optional[str] = None


class ProgressStudentsRequest(BaseModel):
    academic_year: str
    from_class: Optional[str] = None


# ─── Helper: serialize datetime fields ────────────────────────────

def serialize_doc(doc: dict) -> dict:
    for key, val in doc.items():
        if isinstance(val, datetime):
            doc[key] = val.isoformat()
    return doc


def now_iso():
    return datetime.now(timezone.utc).isoformat()


# ─── Auth ─────────────────────────────────────────────────────────

@api_router.post("/auth/register-school")
async def register_school(request: RegisterSchoolRequest):
    try:
        existing = await db.schools.find_one({"email": request.email}, {"_id": 0})
        if existing:
            raise HTTPException(status_code=400, detail="School already registered")

        school_dict = serialize_doc(School(
            name=request.name, address=request.address, phone=request.phone,
            email=request.email, school_type=request.school_type
        ).model_dump())
        await db.schools.insert_one(school_dict)

        user_dict = serialize_doc(User(
            school_id=school_dict['id'], email=request.admin_email,
            password_hash=get_password_hash(request.admin_password),
            full_name=request.admin_name, phone=request.admin_phone,
            role=UserRole.SCHOOL_ADMIN
        ).model_dump())
        await db.users.insert_one(user_dict)

        return {
            "message": "School registered successfully",
            "school_id": school_dict['id'],
            "user_id": user_dict['id'],
            "installation_payment_required": True,
            "installation_fee": 5000
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error registering school: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/auth/login")
async def login(request: LoginRequest):
    try:
        user = await db.users.find_one({"email": request.email}, {"_id": 0})
        if not user or not verify_password(request.password, user['password_hash']):
            raise HTTPException(status_code=401, detail="Invalid credentials")

        school = await db.schools.find_one({"id": user['school_id']}, {"_id": 0}) if user.get('school_id') else None

        token = create_access_token({
            "user_id": user['id'], "email": user['email'],
            "role": user['role'], "school_id": user.get('school_id')
        })

        return {
            "token": token,
            "user": {
                "id": user['id'], "email": user['email'],
                "full_name": user['full_name'], "role": user['role'],
                "school_id": user.get('school_id')
            },
            "school": school
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Schools ──────────────────────────────────────────────────────

@api_router.get("/schools")
async def get_schools(current_user: dict = Depends(get_current_user)):
    if current_user['role'] != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Unauthorized")
    return await db.schools.find({}, {"_id": 0}).to_list(1000)


@api_router.get("/schools/{school_id}")
async def get_school(school_id: str, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != UserRole.SUPER_ADMIN and current_user.get('school_id') != school_id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    school = await db.schools.find_one({"id": school_id}, {"_id": 0})
    if not school:
        raise HTTPException(status_code=404, detail="School not found")
    return school


@api_router.patch("/schools/{school_id}")
async def update_school(school_id: str, update_data: dict, current_user: dict = Depends(get_current_user)):
    try:
        if current_user['role'] not in [UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN]:
            raise HTTPException(status_code=403, detail="Unauthorized")
        if current_user['role'] == UserRole.SCHOOL_ADMIN and current_user.get('school_id') != school_id:
            raise HTTPException(status_code=403, detail="Unauthorized")
        update_data['updated_at'] = now_iso()
        await db.schools.update_one({"id": school_id}, {"$set": update_data})
        return {"message": "School profile updated"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"School update error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Students (Secretary creates, Admin approves) ────────────────

@api_router.post("/students")
async def create_student(request: CreateStudentRequest, current_user: dict = Depends(get_current_user)):
    try:
        allowed = [UserRole.SCHOOL_ADMIN, UserRole.SECRETARY, UserRole.TEACHER]
        if current_user['role'] not in allowed:
            raise HTTPException(status_code=403, detail="Unauthorized")

        # Admin-created students are auto-approved
        auto_approve = current_user['role'] == UserRole.SCHOOL_ADMIN

        student_dict = serialize_doc(Student(
            school_id=current_user['school_id'],
            admission_number=request.admission_number,
            full_name=request.full_name,
            date_of_birth=datetime.fromisoformat(request.date_of_birth),
            gender=request.gender,
            class_name=request.class_name,
            year_of_study=request.year_of_study,
            stream=request.stream,
            guardian_name=request.guardian_name,
            guardian_phone=request.guardian_phone,
            guardian_email=request.guardian_email,
            guardian_relationship=request.guardian_relationship,
            secondary_guardian_name=request.secondary_guardian_name,
            secondary_guardian_phone=request.secondary_guardian_phone,
            secondary_guardian_email=request.secondary_guardian_email,
            secondary_guardian_relationship=request.secondary_guardian_relationship,
            blood_type=request.blood_type,
            allergies=request.allergies,
            chronic_conditions=request.chronic_conditions,
            disabilities=request.disabilities,
            immunization_status=request.immunization_status,
            medical_info=request.medical_info,
            status=StudentStatus.ACTIVE,
            approval_status=ApprovalStatus.APPROVED if auto_approve else ApprovalStatus.PENDING,
            submitted_by=current_user['user_id'],
            approved_by=current_user['user_id'] if auto_approve else None,
            approval_date=now_iso() if auto_approve else None,
        ).model_dump())

        await db.students.insert_one(student_dict)
        return {"message": "Student created", "student_id": student_dict['id'],
                "approval_status": student_dict['approval_status']}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating student: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/students")
async def get_students(
    status: Optional[str] = None,
    approval_status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    if not current_user.get('school_id'):
        raise HTTPException(status_code=403, detail="Unauthorized")

    query = {"school_id": current_user['school_id']}

    # Admin sees all, others only approved
    if current_user['role'] == UserRole.SCHOOL_ADMIN:
        if approval_status and approval_status != "all":
            query["approval_status"] = approval_status
    elif current_user['role'] == UserRole.SECRETARY:
        # Secretary sees their own pending + all approved
        if approval_status and approval_status != "all":
            query["approval_status"] = approval_status
        # Default: show all for secretary (they need to see pending items they submitted)
    else:
        query["approval_status"] = "approved"

    if status and status != "all":
        query["status"] = status

    return await db.students.find(query, {"_id": 0}).to_list(1000)


@api_router.get("/students/{student_id}")
async def get_student(student_id: str, current_user: dict = Depends(get_current_user)):
    student = await db.students.find_one(
        {"id": student_id, "school_id": current_user['school_id']}, {"_id": 0}
    )
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return student


@api_router.put("/students/{student_id}")
async def update_student(student_id: str, update_data: dict, current_user: dict = Depends(get_current_user)):
    try:
        allowed = [UserRole.SCHOOL_ADMIN, UserRole.SECRETARY]
        if current_user['role'] not in allowed:
            raise HTTPException(status_code=403, detail="Unauthorized")
        update_data['updated_at'] = now_iso()
        update_data.pop('_id', None)
        update_data.pop('id', None)
        await db.students.update_one(
            {"id": student_id, "school_id": current_user['school_id']},
            {"$set": update_data}
        )
        return {"message": "Student updated"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update student error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.patch("/students/{student_id}/status")
async def update_student_status(student_id: str, body: dict, current_user: dict = Depends(get_current_user)):
    try:
        await db.students.update_one(
            {"id": student_id, "school_id": current_user['school_id']},
            {"$set": {
                "status": body.get("status", "active"),
                "status_reason": body.get("reason"),
                "status_changed_at": now_iso(),
                "updated_at": now_iso()
            }}
        )
        return {"message": "Student status updated"}
    except Exception as e:
        logger.error(f"Status update error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Staff ────────────────────────────────────────────────────────

@api_router.post("/staff")
async def create_staff(request: CreateStaffRequest, current_user: dict = Depends(get_current_user)):
    try:
        if current_user['role'] not in [UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN]:
            raise HTTPException(status_code=403, detail="Unauthorized")

        # Check if email exists
        existing = await db.users.find_one({"email": request.email}, {"_id": 0})
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")

        user_dict = serialize_doc(User(
            school_id=current_user['school_id'], email=request.email,
            password_hash=get_password_hash(request.password),
            full_name=request.full_name, phone=request.phone, role=request.role
        ).model_dump())
        await db.users.insert_one(user_dict)

        staff_dict = serialize_doc(Staff(
            school_id=current_user['school_id'], user_id=user_dict['id'],
            employee_number=request.employee_number, department=request.department,
            position=request.position, salary=request.salary,
            joined_date=datetime.fromisoformat(request.joined_date)
        ).model_dump())
        await db.staff.insert_one(staff_dict)

        return {"message": "Staff created", "staff_id": staff_dict['id'], "user_id": user_dict['id']}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating staff: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/staff")
async def get_staff(current_user: dict = Depends(get_current_user)):
    if not current_user.get('school_id'):
        raise HTTPException(status_code=403, detail="Unauthorized")

    staff_list = await db.staff.find({"school_id": current_user['school_id']}, {"_id": 0}).to_list(1000)
    for staff in staff_list:
        user = await db.users.find_one({"id": staff['user_id']}, {"_id": 0})
        if user:
            staff['user'] = {k: v for k, v in user.items() if k != 'password_hash'}
    return staff_list


# ─── Payments (Finance creates, Admin approves) ──────────────────

@api_router.post("/payments/initiate")
async def initiate_payment(request: InitiatePaymentRequest, current_user: dict = Depends(get_current_user)):
    try:
        phone = None
        if request.phone_number:
            phone = request.phone_number.strip()
            if phone.startswith("0"):
                phone = "254" + phone[1:]
            elif not phone.startswith("254"):
                phone = "254" + phone

        auto_approve = current_user['role'] == UserRole.SCHOOL_ADMIN
        is_cash_like = request.payment_method in ["cash", "bank_transfer", "cheque"]

        payment_dict = serialize_doc(Payment(
            school_id=current_user['school_id'] or "system",
            student_id=request.student_id,
            amount=request.amount,
            payment_type=request.payment_type,
            payment_method=PaymentMethod(request.payment_method),
            phone_number=phone,
            bank_reference=request.bank_reference,
            cheque_number=request.cheque_number,
            description=request.description,
            status=PaymentStatus.COMPLETED if is_cash_like else PaymentStatus.PENDING,
            approval_status=ApprovalStatus.APPROVED if auto_approve else ApprovalStatus.PENDING,
            submitted_by=current_user['user_id'],
            approved_by=current_user['user_id'] if auto_approve else None,
            approval_date=now_iso() if auto_approve else None,
        ).model_dump())

        if payment_dict.get('completed_at') and isinstance(payment_dict['completed_at'], datetime):
            payment_dict['completed_at'] = payment_dict['completed_at'].isoformat()

        await db.payments.insert_one(payment_dict)

        return {
            "success": True,
            "payment_id": payment_dict['id'],
            "receipt_number": payment_dict['receipt_number'],
            "message": "Payment recorded successfully",
            "approval_status": payment_dict['approval_status']
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Payment error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/payments")
async def get_payments(
    approval_status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    if not current_user.get('school_id'):
        raise HTTPException(status_code=403, detail="Unauthorized")

    query = {"school_id": current_user['school_id']}

    if current_user['role'] == UserRole.SCHOOL_ADMIN:
        if approval_status and approval_status != "all":
            query["approval_status"] = approval_status
    elif current_user['role'] == UserRole.FINANCE:
        if approval_status and approval_status != "all":
            query["approval_status"] = approval_status
    else:
        query["approval_status"] = "approved"

    return await db.payments.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)


# ─── Attendance (Teacher creates, Admin approves) ─────────────────

@api_router.post("/attendance")
async def mark_attendance(request: MarkAttendanceRequest, current_user: dict = Depends(get_current_user)):
    try:
        auto_approve = current_user['role'] == UserRole.SCHOOL_ADMIN

        attendance_dict = serialize_doc(Attendance(
            school_id=current_user['school_id'],
            student_id=request.entity_id if request.entity_type == "student" else None,
            staff_id=request.entity_id if request.entity_type == "staff" else None,
            date=datetime.fromisoformat(request.date),
            status=request.status,
            remarks=request.remarks,
            approval_status=ApprovalStatus.APPROVED if auto_approve else ApprovalStatus.PENDING,
            submitted_by=current_user['user_id'],
            approved_by=current_user['user_id'] if auto_approve else None,
            approval_date=now_iso() if auto_approve else None,
        ).model_dump())

        await db.attendance.insert_one(attendance_dict)
        return {"message": "Attendance marked", "attendance_id": attendance_dict['id'],
                "approval_status": attendance_dict['approval_status']}
    except Exception as e:
        logger.error(f"Attendance error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/attendance")
async def get_attendance(
    date: Optional[str] = None,
    approval_status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {"school_id": current_user['school_id']}

    if current_user['role'] not in [UserRole.SCHOOL_ADMIN, UserRole.TEACHER]:
        query["approval_status"] = "approved"
    elif approval_status and approval_status != "all":
        query["approval_status"] = approval_status

    if date:
        query['date'] = date

    return await db.attendance.find(query, {"_id": 0}).to_list(1000)


# ─── Exams ────────────────────────────────────────────────────────

@api_router.post("/exams")
async def create_exam(request: CreateExamRequest, current_user: dict = Depends(get_current_user)):
    try:
        exam_dict = serialize_doc(Exam(
            school_id=current_user['school_id'],
            name=request.name, class_name=request.class_name,
            year_of_study=request.year_of_study, term=request.term,
            exam_number=request.exam_number, academic_year=request.academic_year,
            exam_date=datetime.fromisoformat(request.exam_date)
        ).model_dump())
        await db.exams.insert_one(exam_dict)
        return {"message": "Exam created", "exam_id": exam_dict['id']}
    except Exception as e:
        logger.error(f"Exam error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/exams")
async def get_exams(current_user: dict = Depends(get_current_user)):
    return await db.exams.find({"school_id": current_user['school_id']}, {"_id": 0}).to_list(1000)


# ─── Results (Teacher creates with CBE, Admin approves) ──────────

@api_router.post("/results")
async def record_result(request: RecordResultRequest, current_user: dict = Depends(get_current_user)):
    try:
        auto_approve = current_user['role'] == UserRole.SCHOOL_ADMIN

        result_dict = serialize_doc(Result(
            school_id=current_user['school_id'],
            exam_id=request.exam_id,
            student_id=request.student_id,
            subject=request.subject,
            marks=request.marks,
            grade=CBEGrade(request.grade),
            teacher_comments=request.teacher_comments,
            approval_status=ApprovalStatus.APPROVED if auto_approve else ApprovalStatus.PENDING,
            submitted_by=current_user['user_id'],
            approved_by=current_user['user_id'] if auto_approve else None,
            approval_date=now_iso() if auto_approve else None,
        ).model_dump())

        await db.results.insert_one(result_dict)
        return {"message": "Result recorded", "result_id": result_dict['id'],
                "approval_status": result_dict['approval_status']}
    except Exception as e:
        logger.error(f"Result error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/results/{student_id}")
async def get_student_results(student_id: str, current_user: dict = Depends(get_current_user)):
    query = {"school_id": current_user['school_id'], "student_id": student_id}
    if current_user['role'] not in [UserRole.SCHOOL_ADMIN, UserRole.TEACHER]:
        query["approval_status"] = "approved"
    return await db.results.find(query, {"_id": 0}).to_list(1000)


# ─── Announcements (Secretary/Teacher creates, Admin approves) ────

@api_router.post("/announcements")
async def create_announcement(request: CreateAnnouncementRequest, current_user: dict = Depends(get_current_user)):
    try:
        auto_approve = current_user['role'] == UserRole.SCHOOL_ADMIN

        announcement_dict = serialize_doc(Announcement(
            school_id=current_user['school_id'],
            title=request.title, content=request.content,
            target_audience=request.target_audience,
            target_class=request.target_class, priority=request.priority,
            created_by=current_user['user_id'],
            approval_status=ApprovalStatus.APPROVED if auto_approve else ApprovalStatus.PENDING,
            submitted_by=current_user['user_id'],
            approved_by=current_user['user_id'] if auto_approve else None,
            approval_date=now_iso() if auto_approve else None,
        ).model_dump())

        await db.announcements.insert_one(announcement_dict)
        return {"message": "Announcement created", "announcement_id": announcement_dict['id'],
                "approval_status": announcement_dict['approval_status']}
    except Exception as e:
        logger.error(f"Announcement error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/announcements")
async def get_announcements(
    approval_status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {"school_id": current_user['school_id']}

    if current_user['role'] in [UserRole.SCHOOL_ADMIN, UserRole.SECRETARY, UserRole.TEACHER]:
        if approval_status and approval_status != "all":
            query["approval_status"] = approval_status
    else:
        query["approval_status"] = "approved"

    return await db.announcements.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)


# ─── Admin Approval Queue ────────────────────────────────────────

@api_router.get("/admin/pending")
async def get_all_pending(current_user: dict = Depends(get_current_user)):
    if current_user['role'] != UserRole.SCHOOL_ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")

    school_id = current_user['school_id']
    pending_query = {"school_id": school_id, "approval_status": "pending"}

    pending_students = await db.students.find(pending_query, {"_id": 0}).to_list(500)
    pending_results = await db.results.find(pending_query, {"_id": 0}).to_list(500)
    pending_attendance = await db.attendance.find(pending_query, {"_id": 0}).to_list(500)
    pending_payments = await db.payments.find(pending_query, {"_id": 0}).to_list(500)
    pending_announcements = await db.announcements.find(pending_query, {"_id": 0}).to_list(500)

    # Enrich with submitter info
    for items, item_type in [
        (pending_students, "student"),
        (pending_results, "result"),
        (pending_attendance, "attendance"),
        (pending_payments, "payment"),
        (pending_announcements, "announcement"),
    ]:
        for item in items:
            item['_type'] = item_type
            if item.get('submitted_by'):
                user = await db.users.find_one({"id": item['submitted_by']}, {"_id": 0, "password_hash": 0})
                item['submitter'] = user

    return {
        "students": pending_students,
        "results": pending_results,
        "attendance": pending_attendance,
        "payments": pending_payments,
        "announcements": pending_announcements,
        "total": len(pending_students) + len(pending_results) + len(pending_attendance) + len(pending_payments) + len(pending_announcements)
    }


@api_router.patch("/admin/approve/{item_type}/{item_id}")
async def approve_item(
    item_type: str,
    item_id: str,
    body: ApprovalActionRequest,
    current_user: dict = Depends(get_current_user)
):
    if current_user['role'] != UserRole.SCHOOL_ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")

    collection_map = {
        "student": "students",
        "result": "results",
        "attendance": "attendance",
        "payment": "payments",
        "announcement": "announcements",
    }

    collection_name = collection_map.get(item_type)
    if not collection_name:
        raise HTTPException(status_code=400, detail="Invalid item type")

    update_data = {
        "approval_status": body.action,
        "approved_by": current_user['user_id'],
        "approval_date": now_iso(),
    }
    if body.reason:
        update_data["rejection_reason"] = body.reason

    result = await db[collection_name].update_one(
        {"id": item_id, "school_id": current_user['school_id']},
        {"$set": update_data}
    )

    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")

    return {"message": f"{item_type.capitalize()} {body.action}"}


# ─── Legacy approval requests (for backward compat) ──────────────

@api_router.post("/finance/request-approval")
async def request_admin_approval(request: dict, current_user: dict = Depends(get_current_user)):
    try:
        if current_user['role'] != UserRole.FINANCE:
            raise HTTPException(status_code=403, detail="Only finance personnel can send requests")
        approval_request = {
            "id": str(uuid.uuid4()),
            "school_id": current_user['school_id'],
            "requested_by": current_user['user_id'],
            "message": request.get("message", ""),
            "request_type": request.get("request_type", "general"),
            "status": "pending",
            "created_at": now_iso()
        }
        await db.approval_requests.insert_one(approval_request)
        return {"message": "Request sent to admin", "request_id": approval_request['id']}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Approval request error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/admin/approval-requests")
async def get_approval_requests(current_user: dict = Depends(get_current_user)):
    if current_user['role'] != UserRole.SCHOOL_ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    return await db.approval_requests.find(
        {"school_id": current_user['school_id']}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)


# ─── Student status & certificates ───────────────────────────────

@api_router.patch("/students/{student_id}/certificate")
async def update_certificate_status(
    student_id: str, collected: bool,
    collection_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    try:
        update_data = {"certificate_collected": collected, "updated_at": now_iso()}
        if collection_date:
            update_data["certificate_collection_date"] = collection_date
        await db.students.update_one(
            {"id": student_id, "school_id": current_user['school_id']},
            {"$set": update_data}
        )
        return {"message": "Certificate status updated"}
    except Exception as e:
        logger.error(f"Certificate update error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Dashboard Stats ─────────────────────────────────────────────

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    try:
        if current_user['role'] == UserRole.SUPER_ADMIN:
            schools_count = await db.schools.count_documents({})
            active_schools = await db.schools.count_documents({"subscription_status": "active"})
            total_revenue = await db.payments.count_documents({"status": "completed"})
            return {
                "total_schools": schools_count,
                "active_schools": active_schools,
                "suspended_schools": schools_count - active_schools,
                "total_revenue": total_revenue * 1000
            }
        else:
            school_id = current_user['school_id']
            students_count = await db.students.count_documents(
                {"school_id": school_id, "approval_status": "approved"}
            )
            staff_count = await db.staff.count_documents({"school_id": school_id})

            today = datetime.now(timezone.utc).date().isoformat()
            present_today = await db.attendance.count_documents({
                "school_id": school_id, "date": today,
                "status": "present", "approval_status": "approved"
            })

            pending_approvals = await db.students.count_documents(
                {"school_id": school_id, "approval_status": "pending"}
            )
            pending_approvals += await db.results.count_documents(
                {"school_id": school_id, "approval_status": "pending"}
            )
            pending_approvals += await db.attendance.count_documents(
                {"school_id": school_id, "approval_status": "pending"}
            )
            pending_approvals += await db.payments.count_documents(
                {"school_id": school_id, "approval_status": "pending"}
            )
            pending_approvals += await db.announcements.count_documents(
                {"school_id": school_id, "approval_status": "pending"}
            )

            pending_fees = await db.payments.count_documents(
                {"school_id": school_id, "status": "pending"}
            )

            return {
                "total_students": students_count,
                "total_staff": staff_count,
                "present_today": present_today,
                "pending_fees": pending_fees,
                "pending_approvals": pending_approvals
            }
    except Exception as e:
        logger.error(f"Stats error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Subscriptions ───────────────────────────────────────────────

@api_router.post("/subscriptions/charge")
async def charge_subscription(school_id: str):
    try:
        school = await db.schools.find_one({"id": school_id}, {"_id": 0})
        if not school:
            raise HTTPException(status_code=404, detail="School not found")

        active_users = school.get('active_users_count', 0)
        monthly_charge = active_users * 1000

        payment_dict = serialize_doc(Payment(
            school_id=school_id, amount=monthly_charge,
            payment_type="monthly_subscription",
            payment_method=PaymentMethod.MPESA,
            phone_number="254702641920",
            status=PaymentStatus.PENDING,
            approval_status=ApprovalStatus.APPROVED,
        ).model_dump())
        if payment_dict.get('completed_at') and isinstance(payment_dict['completed_at'], datetime):
            payment_dict['completed_at'] = payment_dict['completed_at'].isoformat()
        await db.payments.insert_one(payment_dict)

        return {
            "success": True, "school_id": school_id,
            "amount": monthly_charge, "payment_id": payment_dict['id'],
            "message": f"Subscription of KES {monthly_charge} charged for {active_users} users"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Subscription charge error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── M-Pesa Callback ─────────────────────────────────────────────

@api_router.post("/webhooks/mpesa/callback")
async def mpesa_callback(callback: dict):
    try:
        logger.info(f"M-Pesa callback received: {callback}")
        return {"ResultCode": 0, "ResultDesc": "Success"}
    except Exception as e:
        logger.error(f"Callback error: {str(e)}")
        return {"ResultCode": 0, "ResultDesc": "Success"}


# ─── Student Portal Data (linked by student_user_id or first student) ─

@api_router.get("/portal/my-data")
async def get_my_portal_data(current_user: dict = Depends(get_current_user)):
    """Get all data for a student/parent portal user"""
    try:
        school_id = current_user.get('school_id')
        user_id = current_user['user_id']

        # Find student linked to this user
        student = await db.students.find_one(
            {"school_id": school_id, "student_user_id": user_id, "approval_status": "approved"},
            {"_id": 0}
        )
        # Fallback: find by guardian email matching user email
        if not student:
            student = await db.students.find_one(
                {"school_id": school_id, "guardian_email": current_user['email'], "approval_status": "approved"},
                {"_id": 0}
            )
        # Fallback: first approved student in the school
        if not student:
            student = await db.students.find_one(
                {"school_id": school_id, "approval_status": "approved"},
                {"_id": 0}
            )

        if not student:
            return {"student": None, "results": [], "attendance": [], "payments": [], "announcements": [], "fee_balance": 0}

        student_id = student['id']

        # Get approved results with exam info
        results = await db.results.find(
            {"school_id": school_id, "student_id": student_id, "approval_status": "approved"},
            {"_id": 0}
        ).to_list(500)
        for r in results:
            exam = await db.exams.find_one({"id": r.get("exam_id")}, {"_id": 0})
            if exam:
                r["exam_name"] = exam.get("name")
                r["term"] = exam.get("term")
                r["academic_year"] = exam.get("academic_year")

        # Get approved attendance
        attendance_records = await db.attendance.find(
            {"school_id": school_id, "student_id": student_id, "approval_status": "approved"},
            {"_id": 0}
        ).to_list(500)

        # Get approved payments for this student
        payments = await db.payments.find(
            {"school_id": school_id, "student_id": student_id, "approval_status": "approved"},
            {"_id": 0}
        ).sort("created_at", -1).to_list(500)
        # Also get school-wide payments if no student-specific ones
        if not payments:
            payments = await db.payments.find(
                {"school_id": school_id, "approval_status": "approved"},
                {"_id": 0}
            ).sort("created_at", -1).to_list(500)

        # Get fee structure for this class
        fee_structures = await db.fee_structures.find(
            {"school_id": school_id, "class_name": student.get("class_name")},
            {"_id": 0}
        ).to_list(50)
        total_fees = sum(f.get("amount", 0) for f in fee_structures)
        total_paid = sum(p.get("amount", 0) for p in payments if p.get("status") == "completed")
        fee_balance = total_fees - total_paid

        # Get approved announcements
        announcements = await db.announcements.find(
            {"school_id": school_id, "approval_status": "approved"},
            {"_id": 0}
        ).sort("created_at", -1).to_list(100)

        # Calculate attendance stats
        total_days = len(attendance_records)
        present_days = len([a for a in attendance_records if a.get("status") == "present"])
        absent_days = len([a for a in attendance_records if a.get("status") == "absent"])
        late_days = len([a for a in attendance_records if a.get("status") == "late"])
        attendance_rate = round((present_days / total_days * 100), 1) if total_days > 0 else 0

        return {
            "student": student,
            "results": results,
            "attendance": attendance_records,
            "attendance_stats": {
                "total_days": total_days,
                "present": present_days,
                "absent": absent_days,
                "late": late_days,
                "rate": attendance_rate
            },
            "payments": payments,
            "fee_balance": fee_balance,
            "total_fees": total_fees,
            "total_paid": total_paid,
            "announcements": announcements
        }
    except Exception as e:
        logger.error(f"Portal data error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Finance: Income/Expenditure Tracker ──────────────────────────

@api_router.post("/finance/transactions")
async def create_transaction(request: CreateTransactionRequest, current_user: dict = Depends(get_current_user)):
    try:
        allowed = [UserRole.SCHOOL_ADMIN, UserRole.FINANCE]
        if current_user['role'] not in allowed:
            raise HTTPException(status_code=403, detail="Unauthorized")

        auto_approve = current_user['role'] == UserRole.SCHOOL_ADMIN
        txn = {
            "id": str(uuid.uuid4()),
            "school_id": current_user['school_id'],
            "transaction_type": request.transaction_type,
            "category": request.category,
            "amount": request.amount,
            "description": request.description,
            "date": request.date or now_iso(),
            "approval_status": "approved" if auto_approve else "pending",
            "submitted_by": current_user['user_id'],
            "approved_by": current_user['user_id'] if auto_approve else None,
            "created_at": now_iso()
        }
        await db.finance_transactions.insert_one(txn)
        return {"message": "Transaction recorded", "id": txn['id'], "approval_status": txn['approval_status']}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Transaction error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/finance/transactions")
async def get_transactions(current_user: dict = Depends(get_current_user)):
    try:
        allowed = [UserRole.SCHOOL_ADMIN, UserRole.FINANCE]
        if current_user['role'] not in allowed:
            raise HTTPException(status_code=403, detail="Unauthorized")

        query = {"school_id": current_user['school_id']}
        if current_user['role'] != UserRole.SCHOOL_ADMIN:
            query["approval_status"] = "approved"

        txns = await db.finance_transactions.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
        return txns
    except Exception as e:
        logger.error(f"Get transactions error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/finance/summary")
async def get_finance_summary(current_user: dict = Depends(get_current_user)):
    try:
        allowed = [UserRole.SCHOOL_ADMIN, UserRole.FINANCE]
        if current_user['role'] not in allowed:
            raise HTTPException(status_code=403, detail="Unauthorized")

        school_id = current_user['school_id']

        # Payments summary
        payments = await db.payments.find(
            {"school_id": school_id, "approval_status": "approved", "status": "completed"},
            {"_id": 0}
        ).to_list(5000)
        total_fee_income = sum(p.get("amount", 0) for p in payments)

        # Transactions summary
        txns = await db.finance_transactions.find(
            {"school_id": school_id, "approval_status": "approved"},
            {"_id": 0}
        ).to_list(5000)
        total_other_income = sum(t.get("amount", 0) for t in txns if t.get("transaction_type") == "income")
        total_expenditure = sum(t.get("amount", 0) for t in txns if t.get("transaction_type") == "expenditure")

        total_income = total_fee_income + total_other_income
        running_balance = total_income - total_expenditure

        return {
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
        raise HTTPException(status_code=500, detail=str(e))


# ─── Student Progression System ───────────────────────────────────

GRADE_ORDER = [
    "PP1", "PP2", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6",
    "Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12"
]

@api_router.post("/admin/progress-students")
async def progress_students(request: ProgressStudentsRequest, current_user: dict = Depends(get_current_user)):
    """Auto-move approved students to next grade, archiving their current year"""
    if current_user['role'] != UserRole.SCHOOL_ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        school_id = current_user['school_id']
        query = {"school_id": school_id, "approval_status": "approved", "status": "active"}
        if request.from_class:
            query["class_name"] = request.from_class

        students = await db.students.find(query, {"_id": 0}).to_list(5000)
        progressed = 0
        graduated = 0
        archived = []

        for student in students:
            current_class = student.get("class_name")
            if not current_class or current_class not in GRADE_ORDER:
                continue

            idx = GRADE_ORDER.index(current_class)

            # Archive current record
            archive_record = {
                "id": str(uuid.uuid4()),
                "student_id": student["id"],
                "school_id": school_id,
                "academic_year": request.academic_year,
                "class_name": current_class,
                "stream": student.get("stream"),
                "created_at": now_iso()
            }
            await db.student_history.insert_one(archive_record)

            if idx >= len(GRADE_ORDER) - 1:
                # Last grade → graduate
                await db.students.update_one(
                    {"id": student["id"]},
                    {"$set": {"status": "graduated", "status_changed_at": now_iso(), "status_reason": f"Completed {current_class} in {request.academic_year}", "updated_at": now_iso()}}
                )
                graduated += 1
            else:
                # Move to next grade
                next_class = GRADE_ORDER[idx + 1]
                await db.students.update_one(
                    {"id": student["id"]},
                    {"$set": {"class_name": next_class, "updated_at": now_iso()}}
                )
                progressed += 1
                archived.append({"name": student["full_name"], "from": current_class, "to": next_class})

        return {
            "message": f"Progression complete for {request.academic_year}",
            "progressed": progressed,
            "graduated": graduated,
            "total_processed": progressed + graduated,
            "details": archived[:20]
        }
    except Exception as e:
        logger.error(f"Progression error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/students/{student_id}/history")
async def get_student_history(student_id: str, current_user: dict = Depends(get_current_user)):
    """Get historical records for a student"""
    history = await db.student_history.find(
        {"student_id": student_id, "school_id": current_user['school_id']},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return history


# ─── App Setup ────────────────────────────────────────────────────

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
