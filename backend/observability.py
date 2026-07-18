from __future__ import annotations

import json
import logging
import os
import time
import uuid
from collections import defaultdict, deque
from datetime import datetime, timezone
from threading import Lock
from typing import Any, Dict, Optional


SERVICE_NAME = os.getenv("SERVICE_NAME", "smart-m-hub-api")
SERVICE_VERSION = os.getenv("SERVICE_VERSION", "1.0.0")
START_TIME = time.time()


def now_utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def resolve_trace_id(headers: Dict[str, str]) -> str:
    traceparent = headers.get("traceparent") or headers.get("Traceparent")
    if traceparent:
        parts = traceparent.split("-")
        if len(parts) >= 2 and len(parts[1]) == 32:
            return parts[1]
    incoming = headers.get("x-trace-id") or headers.get("X-Trace-ID")
    if incoming:
        return str(incoming)[:128]
    return uuid.uuid4().hex


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "timestamp": now_utc_iso(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "service": SERVICE_NAME,
            "service_version": SERVICE_VERSION,
        }
        event = getattr(record, "event", None)
        if isinstance(event, dict):
            payload.update(event)
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str, separators=(",", ":"))


def configure_logging() -> None:
    if os.getenv("LOG_FORMAT", "json").lower() != "json":
        logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
        return
    root = logging.getLogger()
    root.setLevel(os.getenv("LOG_LEVEL", "INFO").upper())
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    root.handlers = [handler]


class MetricsRegistry:
    def __init__(self, latency_window: int = 500):
        self._lock = Lock()
        self._counters: Dict[str, int] = defaultdict(int)
        self._route_counts: Dict[str, int] = defaultdict(int)
        self._latencies: Dict[str, deque[float]] = defaultdict(lambda: deque(maxlen=latency_window))

    def increment(self, name: str, amount: int = 1, **labels: Any) -> None:
        key = self._key(name, labels)
        with self._lock:
            self._counters[key] += amount

    def record_request(self, method: str, route: str, status_code: int, duration_ms: float) -> None:
        route_key = self._route_key(method, route, status_code)
        family = f"{status_code // 100}xx"
        with self._lock:
            self._counters["http_requests_total"] += 1
            self._counters[f"http_requests_{family}_total"] += 1
            self._route_counts[route_key] += 1
            self._latencies[route_key].append(float(duration_ms))

    def snapshot(self, queue_depth: Optional[int] = None) -> dict:
        with self._lock:
            latencies = {
                route: {
                    "count": len(values),
                    "avg_ms": round(sum(values) / len(values), 2) if values else 0,
                    "max_ms": round(max(values), 2) if values else 0,
                }
                for route, values in self._latencies.items()
            }
            return {
                "service": SERVICE_NAME,
                "service_version": SERVICE_VERSION,
                "uptime_seconds": int(time.time() - START_TIME),
                "counters": dict(self._counters),
                "routes": dict(self._route_counts),
                "latency": latencies,
                "queue_depth": queue_depth,
            }

    def prometheus_text(self, queue_depth: Optional[int] = None) -> str:
        snap = self.snapshot(queue_depth=queue_depth)
        lines = [
            "# HELP smart_m_hub_uptime_seconds Process uptime in seconds.",
            "# TYPE smart_m_hub_uptime_seconds gauge",
            f"smart_m_hub_uptime_seconds {snap['uptime_seconds']}",
        ]
        if queue_depth is not None:
            lines.extend([
                "# HELP smart_m_hub_queue_depth Number of queued background jobs.",
                "# TYPE smart_m_hub_queue_depth gauge",
                f"smart_m_hub_queue_depth {queue_depth}",
            ])
        for name, value in snap["counters"].items():
            metric_name = "smart_m_hub_" + "".join(ch if ch.isalnum() else "_" for ch in name).lower()
            lines.append(f"{metric_name} {value}")
        for route, values in snap["latency"].items():
            route_label = route.replace("\\", "\\\\").replace('"', '\\"')
            lines.append(
                f'smart_m_hub_http_request_latency_avg_ms{{route="{route_label}"}} {values["avg_ms"]}'
            )
        return "\n".join(lines) + "\n"

    @staticmethod
    def _key(name: str, labels: Dict[str, Any]) -> str:
        if not labels:
            return name
        suffix = ",".join(f"{key}={labels[key]}" for key in sorted(labels))
        return f"{name}{{{suffix}}}"

    @staticmethod
    def _route_key(method: str, route: str, status_code: int) -> str:
        return f"{method.upper()} {route} {status_code}"


metrics = MetricsRegistry()
