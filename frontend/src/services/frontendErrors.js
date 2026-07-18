function resolveApiRoot() {
  const configured = process.env.REACT_APP_BACKEND_URL;
  const base = configured || "http://localhost:8000";
  return `${base.replace(/\/$/, "")}/api`;
}

export function reportFrontendError(error, info, portal = "main") {
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
