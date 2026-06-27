import { NavLink } from "react-router-dom";

const linkStyle = ({ isActive }) => ({
  display: "block",
  padding: "10px 12px",
  color: isActive ? "#ffffff" : "#cbd5e1",
  background: isActive ? "#2563eb" : "transparent",
  textDecoration: "none",
  borderRadius: "8px",
  marginBottom: "8px",
  fontSize: "14px",
  fontWeight: isActive ? 600 : 400,
  transition: "all 0.2s ease",
});

export default function Sidebar() {
  return (
    <div
      style={{
        width: "240px",
        minHeight: "100vh",
        background: "#0f172a",
        padding: "16px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          color: "white",
          fontSize: "18px",
          fontWeight: 700,
          marginBottom: "20px",
        }}
      >
        Super Admin
      </div>

      <nav>
        <NavLink to="/" end style={linkStyle}>
          Dashboard
        </NavLink>

        <NavLink to="/schools" style={linkStyle}>
          Schools
        </NavLink>

        <NavLink to="/payments" style={linkStyle}>
          Payments
        </NavLink>

        <NavLink to="/analytics" style={linkStyle}>
          Analytics
        </NavLink>

        <NavLink to="/support" style={linkStyle}>
          Support
        </NavLink>

        <NavLink to="/system" style={linkStyle}>
          System Health
        </NavLink>

        <NavLink to="/approvals" style={linkStyle}>
          Approvals
        </NavLink>
      </nav>
    </div>
  );
}