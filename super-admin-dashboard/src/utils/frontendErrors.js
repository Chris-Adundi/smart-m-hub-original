function resolveApiRoot() {
  const configured = import.meta.env.VITE_API_BASE_URL;
  const base = configured || "http://localhost:8000/api";
  return base.replace(/\/$/, "");
}

export function reportFrontendError(error, info, portal = "super-admin") {
  const payload = {
    message: error?.message || String(error || "Unknown frontend error"),
    stack: error?.stack || "",
    component_stack: info?.componentStack || "",
    route: window.location.pathname,
    portal,
    user_agent: window.navigator.userAgent,
  };

  fetch(`${resolveApiRoot()}/frontend-errors`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {});
}
