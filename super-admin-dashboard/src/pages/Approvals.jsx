import { useEffect, useState } from "react";
import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000/api/platform";

export default function Approvals() {
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const getHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem("access_token")}`,
  });

  async function load() {
    try {
      setLoading(true);
      setError("");

     console.log("API URL =", `${API_BASE_URL}/schools/pending`);

  const res = await axios.get(
    `${API_BASE_URL}/schools/pending`,
    {
      headers: getHeaders(),
    }
  );

      setSchools(res.data?.schools || []);
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
        err?.message ||
        "Failed to load pending approvals"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function approve(id) {
    try {
      await axios.patch(
        `${API_BASE_URL}/schools/${id}/approve`,
        {},
        {
          headers: getHeaders(),
        }
      );

      await load();
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
        err?.message ||
        "Failed to approve school"
      );
    }
  }

  if (loading) {
    return <div style={{ padding: 20 }}>Loading approvals...</div>;
  }

  if (error) {
    return <div style={{ padding: 20, color: "red" }}>{error}</div>;
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Pending School Approvals</h2>

      {schools.length === 0 ? (
        <p>No pending approvals</p>
      ) : (
        schools.map((s) => (
          <div
            key={s.id}
            style={{
              border: "1px solid #ddd",
              padding: "12px",
              marginBottom: "10px",
              borderRadius: "8px",
            }}
          >
            <h4>{s.name}</h4>

            <button onClick={() => approve(s.id)}>
              Approve
            </button>
          </div>
        ))
      )}
    </div>
  );
}