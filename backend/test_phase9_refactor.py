from app.core.responses import api_success, error_code_for_status
from app.core.roles import STAFF_AUTH_ROLES, STAFF_DESIGNATIONS, is_staff_auth_role, normalize_staff_designation
from app.core.serialization import ensure_id, serialize_doc
from server import DOMAIN_ROUTE_COUNTS, app


def test_shared_response_helpers_match_existing_contract():
    body = api_success({"id": "1"}, message="Saved", count=1)

    assert body == {"success": True, "data": {"id": "1"}, "message": "Saved", "count": 1}
    assert error_code_for_status(403) == "permission_denied"
    assert error_code_for_status(599) == "api_error"


def test_serialization_helpers_remove_mongo_id_and_preserve_id():
    doc = serialize_doc({"_id": "mongo", "id": "public", "name": "Learner"})

    assert doc == {"id": "public", "name": "Learner"}
    assert ensure_id({"name": "No ID"}).get("id")


def test_staff_auth_roles_are_separate_from_designations():
    assert is_staff_auth_role("Teacher")
    assert "teacher" in STAFF_AUTH_ROLES
    assert "principal" not in STAFF_AUTH_ROLES
    assert "principal" in STAFF_DESIGNATIONS
    assert normalize_staff_designation("Deputy Principal") == "deputy_principal"


def test_domain_routes_are_extracted_without_changing_public_paths():
    assert DOMAIN_ROUTE_COUNTS["staff"] > 0
    assert DOMAIN_ROUTE_COUNTS["students"] > 0
    assert DOMAIN_ROUTE_COUNTS["finance"] > 0
    assert DOMAIN_ROUTE_COUNTS["cbc"] > 0

    paths = {getattr(route, "path", "") for route in app.routes}
    assert "/api/staff" in paths
    assert "/api/students" in paths
    assert "/api/assessments/reports" in paths
