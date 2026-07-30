import asyncio
from types import SimpleNamespace

import server
from pydantic import ValidationError


class FakeCursor:
    def __init__(self, documents):
        self.documents = documents

    async def to_list(self, length):
        return self.documents[:length]


class FakeStudents:
    def __init__(self, documents):
        self.documents = documents

    def find(self, query, projection=None):
        eligible = [doc for doc in self.documents if all(
            (doc.get(key) != value.get("$ne") if isinstance(value, dict) and "$ne" in value else doc.get(key) == value)
            for key, value in query.items()
        )]
        return FakeCursor(eligible)

    async def update_many(self, query, update):
        matched = self.find(query).documents
        for document in matched:
            document.update(update["$set"])
        return SimpleNamespace(modified_count=len(matched))


class FakeUsers:
    def __init__(self, teacher):
        self.teacher = teacher

    async def find_one(self, query, projection=None):
        if query.get("id") == self.teacher["id"] and query.get("school_id") == self.teacher["school_id"]:
            return self.teacher
        return None


class FakeHistory:
    def __init__(self):
        self.documents = []

    async def insert_many(self, documents, ordered=False):
        self.documents.extend(documents)


def test_teacher_progresses_only_assigned_roster_and_preserves_identity(monkeypatch):
    students = [
        {"id": "student-1", "school_id": "school-a", "admission_number": "ADM-1", "full_name": "Learner One", "class_name": "Grade 4", "stream": "East", "status": "active", "approval_status": "approved"},
        {"id": "student-other-school", "school_id": "school-b", "admission_number": "ADM-2", "full_name": "Other Learner", "class_name": "Grade 4", "status": "active", "approval_status": "approved"},
    ]
    fake_db = SimpleNamespace(
        students=FakeStudents(students),
        users=FakeUsers({"id": "teacher-1", "school_id": "school-a", "selected_classes": ["Grade 4"]}),
        student_history=FakeHistory(),
    )
    monkeypatch.setattr(server, "db", fake_db)

    async def no_log(*args, **kwargs):
        return None
    monkeypatch.setattr(server, "log_security_event", no_log)

    response = asyncio.run(server.progress_assigned_students(
        server.ProgressStudentsRequest(from_class="Grade 4", academic_year="1999"),
        {"user_id": "teacher-1", "school_id": "school-a", "role": "teacher"},
    ))

    assert response["data"]["academic_year"] == str(server.now_utc().year)
    assert students[0]["class_name"] == "Grade 5"
    assert students[0]["admission_number"] == "ADM-1"
    assert students[0]["full_name"] == "Learner One"
    assert students[1]["class_name"] == "Grade 4"
    assert fake_db.student_history.documents[0]["from_class"] == "Grade 4"
    assert fake_db.student_history.documents[0]["to_class"] == "Grade 5"

    duplicate = asyncio.run(server.progress_assigned_students(
        server.ProgressStudentsRequest(from_class="Grade 4"),
        {"user_id": "teacher-1", "school_id": "school-a", "role": "teacher"},
    ))
    assert duplicate["data"]["progressed"] == 0


def test_terminal_class_and_unassigned_class_are_rejected(monkeypatch):
    fake_db = SimpleNamespace(
        users=FakeUsers({"id": "teacher-1", "school_id": "school-a", "selected_classes": ["Grade 4"]}),
    )
    monkeypatch.setattr(server, "db", fake_db)
    for class_name in ("Grade 5", "Grade 12"):
        try:
            asyncio.run(server.progress_assigned_students(
                server.ProgressStudentsRequest(from_class=class_name),
                {"user_id": "teacher-1", "school_id": "school-a", "role": "teacher"},
            ))
        except server.HTTPException as exc:
            assert exc.status_code in {400, 403}
        else:
            raise AssertionError("Unauthorized or terminal progression must be rejected")


def test_staff_payload_uses_designation_without_removed_fields():
    payload = server.CreateStaffPayload(
        full_name="Teacher One",
        email="teacher@example.com",
        employee_number="EMP-1",
        designation="Teacher",
        password="StrongPass123!",
    )
    fields = payload.model_dump()
    assert fields["designation"] == "Teacher"
    assert "date_of_birth" not in fields
    assert "staff_category" not in fields
    assert "department" not in fields
    assert "position" not in fields
    assert fields["selected_classes"] is None

    teacher = server.CreateStaffPayload(
        full_name="Teacher Assigned",
        email="assigned@example.com",
        employee_number="NA",
        designation="Teacher",
        password="StrongPass123!",
        selected_classes=["Grade 4", "Grade 5"],
    )
    assert teacher.selected_classes == ["Grade 4", "Grade 5"]
    try:
        server.CreateStaffPayload(
            full_name="Teacher Two",
            email="teacher2@example.com",
            employee_number="EMP-2",
            password="StrongPass123!",
        )
    except ValidationError:
        pass
    else:
        raise AssertionError("Designation must remain the staff role description")
