import { useEffect, useState } from "react";
import api from "../api/platformApi";

export default function SystemHealth() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");

        const res = await api.get("/system-health");
        setHealth(res.data);
      } catch (err) {
        setError(
          err?.response?.data?.detail ||
          err?.message ||
          "Failed to load system health"
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 20 }}>
        Loading system health...
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
      <h2>System Health</h2>

      <div
        style={{
          marginTop: "20px",
          background: "#fff",
          padding: "20px",
          border: "1px solid #ddd",
          borderRadius: "8px",
        }}
      >
        <p>
          <strong>Status:</strong> {health?.status}
        </p>

        <p>
          <strong>Database:</strong> {health?.database}
        </p>

        <p>
          <strong>Timestamp:</strong> {health?.timestamp}
        </p>
      </div>
    </div>
  );
}
