from services.report_artifacts import payload_checksum
from services.pdf_renderer import render_simple_report_pdf
from services.webhooks import sign_webhook_payload
from worker import handle_job
from server import app, build_report_from_template


class FakeCollection:
    def __init__(self):
        self.updated = []

    async def update_one(self, query, update):
        self.updated.append((query, update))


class FakeDB:
    def __init__(self):
        self.webhook_events = FakeCollection()
        self.jobs = FakeCollection()

    def __getitem__(self, name):
        return getattr(self, name)


class FakeServer:
    def __init__(self):
        self.db = FakeDB()

    @staticmethod
    def now_utc():
        return "now"


def test_report_artifact_checksum_is_stable():
    first = payload_checksum({"b": 2, "a": 1})
    second = payload_checksum({"a": 1, "b": 2})

    assert first == second
    assert len(first) == 64


def test_simple_report_renderer_returns_pdf_bytes():
    pdf = render_simple_report_pdf({
        "school_details": {"name": "School"},
        "learner_details": {"full_name": "Learner"},
        "learning_areas": [{"name": "English", "overall_grade": "AE"}],
    })

    assert pdf.startswith(b"%PDF-1.4")
    assert b"%%EOF" in pdf


def test_webhook_signature_is_stable_for_canonical_payload():
    first = sign_webhook_payload({"b": 2, "a": 1}, "secret")
    second = sign_webhook_payload({"a": 1, "b": 2}, "secret")

    assert first == second
    assert len(first) == 64


def test_build_report_stores_template_snapshot_and_version():
    report = __import__("asyncio").run(build_report_from_template(
        {"name": "School"},
        {"id": "stu1", "school_id": "school1", "class_name": "Grade 4", "status": "active"},
        {"id": "exam1", "name": "CAT 1"},
        {"id": "tpl1", "version": 3, "learning_areas": [{"name": "English"}]},
        {"user_id": "admin"},
    ))

    assert report["template_version"] == 3
    assert report["template_snapshot"]["id"] == "tpl1"
    assert report["learning_areas"] == [{"name": "English"}]


def test_future_foundation_routes_are_registered():
    paths = {getattr(route, "path", "") for route in app.routes}

    assert "/api/mobile/sync-manifest" in paths
    assert "/api/webhooks/endpoints" in paths


def test_worker_accepts_webhook_delivery_job():
    fake_server = FakeServer()
    __import__("asyncio").run(handle_job(fake_server, {
        "id": "job1",
        "job_type": "webhook_delivery",
        "payload": {"webhook_event_id": "evt1"},
    }))

    assert fake_server.db.webhook_events.updated
