import { useEffect, useState } from "react";
import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000/api/platform";

export default function Payments() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");

        const token = localStorage.getItem("access_token");
        console.log("API URL =", `${API_BASE_URL}/payments/summary`);
        const res = await axios.get(
          `${API_BASE_URL}/payments/summary`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        setData(res.data);
      } catch (err) {
        setError(
          err?.response?.data?.detail ||
          err?.message ||
          "Failed to load payments data"
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) {
    return <div style={{ padding: 20 }}>Loading payments...</div>;
  }

  if (error) {
    return <div style={{ padding: 20, color: "red" }}>{error}</div>;
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Payments Overview</h2>

      <p>
        <strong>Total Payments:</strong>{" "}
        {data?.totalPayments ?? 0}
      </p>

      <p>
        <strong>Total Revenue:</strong>{" "}
        {data?.totalRevenue ?? 0}
      </p>

      <p>
        <strong>Pending Payments:</strong>{" "}
        {data?.pendingPayments ?? 0}
      </p>
    </div>
  );
}