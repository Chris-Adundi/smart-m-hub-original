from __future__ import annotations

from typing import Any, Optional


def api_success(data: Any = None, message: Optional[str] = None, **extra: Any) -> dict:
    response = {
        "success": True,
        "data": data,
    }
    if message:
        response["message"] = message
    response.update(extra)
    return response


def error_code_for_status(status_code: int) -> str:
    return {
        400: "bad_request",
        401: "unauthorized",
        403: "permission_denied",
        404: "not_found",
        409: "conflict",
        413: "payload_too_large",
        422: "validation_error",
        423: "locked",
        429: "rate_limited",
        500: "internal_error",
        503: "service_unavailable",
    }.get(status_code, "api_error")
