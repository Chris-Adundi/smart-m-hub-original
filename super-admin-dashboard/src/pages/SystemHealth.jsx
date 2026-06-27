import { useEffect, useState } from "react";
import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000/api/platform";

export default function SystemHealth() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");

        const token = localStorage.getItem("access_token");

        console.log("TOKEN =", token);

        const res = await axios.get(
          `${API_BASE_URL}/system-health`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
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