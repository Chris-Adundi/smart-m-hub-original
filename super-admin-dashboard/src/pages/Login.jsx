import { useState } from "react";
import axios from "axios";
import { Navigate, useNavigate } from "react-router-dom";
import { getAuthToken, isSuperAdmin, saveSession } from "../auth/superAdminAuth";

const resolveApiRoot = () => {
  const configured = import.meta.env.VITE_API_BASE_URL;
  if (configured) return configured.replace(/\/platform\/?$/, "");
  if (import.meta.env.PROD) {
    throw new Error("VITE_API_BASE_URL must be set for deployed builds");
  }
  return "http://127.0.0.1:8000/api";
};

const API_ROOT = resolveApiRoot();

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetCodeSent, setResetCodeSent] = useState(false);
  const [resetForm, setResetForm] = useState({
    email: "",
    code: "",
    newPassword: "",
  });
  const navigate = useNavigate();

  if (getAuthToken() && isSuperAdmin()) {
    return <Navigate to="/" replace />;
  }

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
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

  const requestReset = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);

    try {
      const { data } = await axios.post(`${API_ROOT}/auth/forgot-password`, {
        email: resetForm.email.trim().toLowerCase(),
      });
      setResetCodeSent(true);
      setNotice(data?.reset_code ? `Verification code: ${data.reset_code}` : data?.message || "Verification code sent if the account details are valid.");
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || "Unable to request password reset");
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);

    try {
      const { data } = await axios.post(`${API_ROOT}/auth/reset-password`, {
        email: resetForm.email.trim().toLowerCase(),
        code: resetForm.code.trim(),
        new_password: resetForm.newPassword,
      });
      setNotice(data?.message || "Password reset. You can now sign in with the new password.");
      setPassword("");
      setResetMode(false);
      setResetCodeSent(false);
      setEmail(resetForm.email.trim().toLowerCase());
      setResetForm((current) => ({ ...current, code: "", newPassword: "" }));
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || "Unable to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={pageStyle}>
      <form style={panelStyle} onSubmit={resetMode ? (resetCodeSent ? resetPassword : requestReset) : submit}>
        <div>
          <h1 style={titleStyle}>SMART M HUB</h1>
          <p style={mutedStyle}>{resetMode ? "Reset platform owner password" : "Platform owner access"}</p>
        </div>

        {error && <div style={errorStyle}>{error}</div>}
        {notice && <div style={noticeStyle}>{notice}</div>}

        {resetMode ? (
          <>
            <label style={labelStyle}>
              Email
              <input
                style={inputStyle}
                type="email"
                value={resetForm.email}
                onChange={(event) => setResetForm({ ...resetForm, email: event.target.value })}
                required
              />
            </label>

            {resetCodeSent && (
              <>
                <label style={labelStyle}>
                  Verification Code
                  <input
                    style={inputStyle}
                    value={resetForm.code}
                    onChange={(event) => setResetForm({ ...resetForm, code: event.target.value })}
                    required
                  />
                </label>

                <label style={labelStyle}>
                  New Password
                  <input
                    style={inputStyle}
                    type="password"
                    value={resetForm.newPassword}
                    onChange={(event) => setResetForm({ ...resetForm, newPassword: event.target.value })}
                    required
                  />
                </label>
              </>
            )}
          </>
        ) : (
          <>
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
          </>
        )}

        <button style={buttonStyle} disabled={loading}>
          {loading
            ? resetMode ? "Processing..." : "Signing in..."
            : resetMode
              ? resetCodeSent ? "Change Password" : "Send Verification Code"
              : "Open Super Admin"}
        </button>

        <button
          type="button"
          style={linkButtonStyle}
          onClick={() => {
            setError("");
            setNotice("");
            setResetMode(!resetMode);
            setResetCodeSent(false);
          }}
        >
          {resetMode ? "Back to sign in" : "Forgot password?"}
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
const noticeStyle = {
  background: "#052e1b",
  color: "#bbf7d0",
  border: "1px solid #166534",
  borderRadius: 8,
  padding: 12,
};
const linkButtonStyle = {
  background: "transparent",
  color: "#93c5fd",
  border: 0,
  padding: 0,
  cursor: "pointer",
  fontWeight: 700,
};
