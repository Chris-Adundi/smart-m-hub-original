import asyncio

from services import external_notifications as notifications


class DeliveryCollection:
    def __init__(self):
        self.documents = []

    async def insert_many(self, documents):
        self.documents.extend(documents)

    async def insert_one(self, document):
        self.documents.append(document)


class FakeDb:
    def __init__(self):
        self.notification_deliveries = DeliveryCollection()
        self.jobs = DeliveryCollection()

    def __getitem__(self, name):
        return getattr(self, name)


class RecordingEmailProvider(notifications.EmailProvider):
    def __init__(self):
        self.sent = []

    async def send(self, *, to, subject, text):
        self.sent.append({"to": to, "subject": subject, "text": text})
        return "email-ref"


class RecordingSmsProvider(notifications.SmsProvider):
    def __init__(self):
        self.sent = []

    async def send(self, *, to, text):
        self.sent.append({"to": to, "text": text})
        return "sms-ref"


class FailingProvider(notifications.EmailProvider):
    async def send(self, **_kwargs):
        raise RuntimeError("provider unavailable")


def dispatch(monkeypatch, recipients, channels=("email", "sms"), email_provider=None, sms_provider=None):
    database = FakeDb()
    email_provider = email_provider or RecordingEmailProvider()
    sms_provider = sms_provider or RecordingSmsProvider()
    monkeypatch.setattr(notifications, "get_email_provider", lambda: email_provider)
    monkeypatch.setattr(notifications, "get_sms_provider", lambda: sms_provider)
    result = asyncio.run(notifications.dispatch_notifications(
        database,
        school_id="school-a",
        title="Test notice",
        message="A school message",
        recipients=recipients,
        channels=channels,
        event_type="test",
        requested_by="admin-a",
    ))
    return result, database, email_provider, sms_provider


def test_email_notification_dispatch(monkeypatch):
    result, database, email, _sms = dispatch(monkeypatch, [{
        "id": "user-a", "school_id": "school-a", "email": " Parent@Example.COM ",
    }], channels=("email",))
    assert result == {"total": 1, "succeeded": 1, "failed": 0, "skipped": 0, "channels": ["email"]}
    assert email.sent[0]["to"] == "parent@example.com"
    assert database.notification_deliveries.documents[0]["status"] == "sent"
    assert notifications.normalize_email(" ChrispinusAdundi@gmail.com ") == "chrispinusadundi@gmail.com"


def test_sms_notification_dispatch_and_kenyan_normalization(monkeypatch):
    result, _database, _email, sms = dispatch(monkeypatch, [{
        "id": "user-a", "school_id": "school-a", "phone": "0712 345 678",
    }], channels=("sms",))
    assert result["succeeded"] == 1
    assert sms.sent[0]["to"] == "+254712345678"
    assert notifications.normalize_kenyan_phone("254712345678") == "+254712345678"
    assert notifications.normalize_kenyan_phone("+254712345678") == "+254712345678"
    assert notifications.normalize_kenyan_phone("0112345678") == "+254112345678"
    assert notifications.normalize_kenyan_phone("0717392164") == "+254717392164"


def test_missing_and_invalid_phone_numbers_are_not_sent(monkeypatch):
    result, database, _email, sms = dispatch(monkeypatch, [
        {"id": "missing", "school_id": "school-a", "phone": None},
        {"id": "invalid", "school_id": "school-a", "phone": "12345"},
    ], channels=("sms",))
    assert result["total"] == 0
    assert result["skipped"] == 2
    assert sms.sent == []
    assert database.notification_deliveries.documents == []


def test_tenant_isolation_rejects_other_school_recipient(monkeypatch):
    result, _database, email, sms = dispatch(monkeypatch, [{
        "id": "user-b", "school_id": "school-b", "email": "other@example.com", "phone": "0712345678",
    }])
    assert result["skipped"] == 2
    assert result["total"] == 0
    assert email.sent == []
    assert sms.sent == []


def test_provider_failure_is_recorded_without_raising(monkeypatch):
    result, database, _email, _sms = dispatch(
        monkeypatch,
        [{"id": "user-a", "school_id": "school-a", "email": "parent@example.com"}],
        channels=("email",),
        email_provider=FailingProvider(),
    )
    assert result["failed"] == 1
    assert result["succeeded"] == 0
    assert database.notification_deliveries.documents[0]["status"] == "failed"
    assert database.notification_deliveries.documents[0]["error"] == "provider unavailable"


def test_guardian_recipients_use_both_recorded_contacts():
    recipients = notifications.student_guardian_recipients({
        "id": "student-a",
        "guardian_email": "one@example.com",
        "guardian_phone": "0712345678",
        "secondary_guardian_email": "two@example.com",
        "secondary_guardian_phone": "0112345678",
    }, school_id="school-a")
    assert recipients == [
        {"id": "student-a:guardian1", "school_id": "school-a", "email": "one@example.com", "phone": "0712345678"},
        {"id": "student-a:guardian2", "school_id": "school-a", "email": "two@example.com", "phone": "0112345678"},
    ]


def test_large_notification_batch_is_queued_without_calling_providers(monkeypatch):
    database = FakeDb()
    email = RecordingEmailProvider()
    sms = RecordingSmsProvider()
    monkeypatch.setattr(notifications, "get_email_provider", lambda: email)
    monkeypatch.setattr(notifications, "get_sms_provider", lambda: sms)
    recipients = [{
        "id": f"parent-{index}",
        "school_id": "school-a",
        "email": f"parent{index}@example.com",
        "phone": f"0712{index:06d}",
    } for index in range(11)]
    result = asyncio.run(notifications.dispatch_notifications(
        database,
        school_id="school-a",
        title="Results published",
        message="Results are available.",
        recipients=recipients,
        channels=["email", "sms"],
        event_type="results_published",
    ))
    assert result["queued"] == 22
    assert len(database.jobs.documents) == 2
    assert email.sent == []
    assert sms.sent == []
