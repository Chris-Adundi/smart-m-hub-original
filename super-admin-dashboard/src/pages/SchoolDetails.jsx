import { useEffect, useState } from "react";
import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000/api/platform";

export default function SchoolDetails() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");

        const res = await axios.get(`${API_BASE_URL}/schools/summary`);
        setData(res.data);
      } catch (err) {
        setError(
          err?.response?.data?.detail ||
            err?.message ||
            "Failed to load school data"
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
        Loading school data...
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
      <h2 style={{ marginBottom: 20 }}>School Details</h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
        }}
      >
        <div style={cardStyle}>
          <h4>Total Payments</h4>
          <h2>{data?.totalPayments ?? 0}</h2>
        </div>

        <div style={cardStyle}>
          <h4>Total Revenue</h4>
          <h2>{data?.totalRevenue ?? 0}</h2>
        </div>

        <div style={cardStyle}>
          <h4>Pending Payments</h4>
          <h2>{data?.pendingPayments ?? 0}</h2>
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