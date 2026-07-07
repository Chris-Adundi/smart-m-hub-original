import { useState } from "react";
import axios from "axios";
import { Navigate, useNavigate } from "react-router-dom";
import { getAuthToken, isSuperAdmin, saveSession } from "../auth/superAdminAuth";

const API_ROOT = (
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000/api/platform"
).replace(/\/platform\/?$/, "");

export default function Login() {
  const [email, setEmail] = useState("developer@system.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  if (getAuthToken() && isSuperAdmin()) {
    return <Navigate to="/" replace />;
  }

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { data } = await axios.post(`${API_ROOT}/auth/login`, {
        email,
        password,
      });

      const role = String(data?.user?.role || "").toLowerCase();
      if (role !== "super_admin") {
        setError("Only the platform owner can access this dashboard.");
        return;
      }

      saveSession(data.access_token, data.user);
      navigate("/", { replace: true });
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          err?.message ||
          "Unable to sign in"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={pageStyle}>
      <form style={panelStyle} onSubmit={submit}>
        <div>
          <h1 style={titleStyle}>SMART M HUB</h1>
          <p style={mutedStyle}>Platform owner access</p>
        </div>

        {error && <div style={errorStyle}>{error}</div>}

        <label style={labelStyle}>
          Email
          <input
            style={inputStyle}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>

        <label style={labelStyle}>
          Password
          <input
            style={inputStyle}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        <button style={buttonStyle} disabled={loading}>
          {loading ? "Signing in..." : "Open Super Admin"}
        </button>
      </form>
    </main>
  );
}

const pageStyle = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#070b14",
  color: "#e5edf8",
  padding: 24,
};
const panelStyle = {
  width: "100%",
  maxWidth: 420,
  background: "#101827",
  border: "1px solid #233047",
  borderRadius: 8,
  padding: 24,
  display: "grid",
  gap: 16,
};
const titleStyle = { margin: 0, color: "#f8fafc", fontSize: 28 };
const mutedStyle = { margin: "6px 0 0", color: "#94a3b8" };
const labelStyle = { display: "grid", gap: 8, color: "#cbd5e1", fontSize: 13 };
const inputStyle = {
  background: "#0b1220",
  border: "1px solid #334155",
  color: "#f8fafc",
  borderRadius: 8,
  padding: "11px 12px",
};
const buttonStyle = {
  background: "#2563eb",
  color: "white",
  border: 0,
  borderRadius: 8,
  padding: "11px 14px",
  cursor: "pointer",
  fontWeight: 700,
};
const errorStyle = {
  background: "#451a1a",
  color: "#fecaca",
  border: "1px solid #7f1d1d",
  borderRadius: 8,
  padding: 12,
};
