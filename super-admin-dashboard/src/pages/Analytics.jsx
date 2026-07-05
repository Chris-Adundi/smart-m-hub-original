import { useEffect, useState } from "react";
import api from "../api/platformApi";

export default function Analytics() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");

        const res = await api.get("/metrics");
        setStats(res.data);
      } catch (err) {
        setError(
          err?.response?.data?.detail ||
            err?.message ||
            "Failed to load analytics"
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
        Loading analytics...
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
      <h2 style={{ marginBottom: 20 }}>Platform Analytics</h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
        }}
      >
        <div style={cardStyle}>
          <h4>Total Schools</h4>
          <h2>{stats?.total_schools ?? 0}</h2>
        </div>

        <div style={cardStyle}>
          <h4>Active Schools</h4>
          <h2>{stats?.active_schools ?? 0}</h2>
        </div>

        <div style={cardStyle}>
          <h4>Total Users</h4>
          <h2>{stats?.total_users ?? 0}</h2>
        </div>
      </div>
    </div>
  );
}

const cardStyle = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: "12px",
  padding: "16px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
};
