import { useEffect, useState } from "react";
import api from "../api/platformApi";

export default function DashboardHome() {
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadMetrics() {
      try {
        const res = await api.get("/metrics");

        setMetrics(res.data);
      } catch (err) {
        setError(err?.response?.data?.detail || err.message);
      }
    }

    loadMetrics();
  }, []);

  return (
    <div>
      <h1>Dashboard Home</h1>

      {error && (
        <div style={{ color: "red", marginTop: "10px" }}>
          Error: {error}
        </div>
      )}

      {metrics && (
        <div style={{ marginTop: "20px" }}>
          <p>Total Schools: {metrics.total_schools}</p>
          <p>Active Schools: {metrics.active_schools}</p>
          <p>Inactive Schools: {metrics.inactive_schools}</p>
          <p>Total Users: {metrics.total_users}</p>
          <p>Total Revenue: {metrics.total_revenue}</p>
        </div>
      )}
    </div>
  );
}
