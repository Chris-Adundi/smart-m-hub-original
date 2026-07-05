import { useEffect, useState } from "react";
import api from "../api/platformApi";

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");

        const res = await api.get("/audit-logs");
        setLogs(res.data?.logs || res.data || []);
      } catch (err) {
        setError(
          err?.response?.data?.detail ||
            err?.message ||
            "Failed to load audit logs"
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 20, color: "#6b7280" }}>
        Loading audit logs...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 20, color: "red" }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{ padding: 10 }}>
      <h2 style={{ marginBottom: 20 }}>Audit Logs</h2>

      {logs.length === 0 ? (
        <div style={{ color: "#9ca3af" }}>
          No audit logs found
        </div>
      ) : (
        logs.map((log, i) => (
          <div
            key={log.id || i}
            style={{
              borderBottom: "1px solid #e5e7eb",
              padding: "12px 0",
            }}
          >
            <div style={{ fontWeight: 500 }}>
              {log.action || "Unknown action"}
            </div>

            <div style={{ fontSize: "12px", color: "#6b7280" }}>
              {log.performed_by || "System"} —{" "}
              {log.timestamp || "No timestamp"}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
