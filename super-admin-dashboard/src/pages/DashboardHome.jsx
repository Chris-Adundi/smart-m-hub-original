import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/platformApi";

const money = (value) => `KES ${Number(value || 0).toLocaleString()}`;

export default function DashboardHome() {
  const [metrics, setMetrics] = useState({});
  const [alerts, setAlerts] = useState([]);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([api.get("/metrics"), api.get("/alerts")])
      .then(([m, a]) => {
        setMetrics(m.data || {});
        setAlerts(a.data || []);
      })
      .catch((err) => setError(err.message));
  }, []);

  const cards = [
    ["Total Registered Schools", metrics.total_registered_schools, "/schools"],
    ["Active Schools", metrics.active_schools, "/schools"],
    ["Suspended Schools", metrics.suspended_schools, "/schools"],
    ["Trial Schools", metrics.trial_schools, "/schools"],
    ["Monthly Revenue", money(metrics.monthly_revenue), "/payments"],
    ["Outstanding Revenue", money(metrics.outstanding_revenue), "/payments"],
    ["New Registrations", metrics.new_registrations, "/approvals"],
    ["Pending Approvals", metrics.pending_approvals, "/approvals"],
    ["Open Support Tickets", metrics.open_support_tickets, "/support"],
    ["System Health", metrics.system_health || "checking", "/system"],
    ["Active Users", metrics.active_users, "/analytics"],
    ["Daily Login Statistics", metrics.daily_login_statistics, "/analytics"],
  ];

  return (
    <div>
      <div style={headerStyle}>
        <div>
          <h1 style={titleStyle}>Platform Dashboard</h1>
          <p style={mutedStyle}>Owner-only operational view of schools, revenue, approvals, users and health.</p>
        </div>
        <button style={primaryButton} onClick={() => navigate("/control")}>Platform Control</button>
      </div>

      {error && <div style={errorStyle}>{error}</div>}

      <div style={gridStyle}>
        {cards.map(([title, value, to]) => (
          <button key={title} style={cardStyle} onClick={() => navigate(to)}>
            <span style={labelStyle}>{title}</span>
            <strong style={valueStyle}>{value ?? 0}</strong>
          </button>
        ))}
      </div>

      <section style={panelStyle}>
        <h2 style={sectionTitle}>Alerts</h2>
        {alerts.length === 0 ? (
          <p style={mutedStyle}>No active platform alerts.</p>
        ) : (
          alerts.map((alert, index) => (
            <button key={index} style={alertStyle} onClick={() => navigate(alert.type === "critical" ? "/system" : "/approvals")}>
              <strong>{alert.type}</strong>
              <span>{alert.message}</span>
            </button>
          ))
        )}
      </section>
    </div>
  );
}

const headerStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 24 };
const titleStyle = { margin: 0, fontSize: 30, color: "#f8fafc" };
const mutedStyle = { color: "#94a3b8", margin: "6px 0 0" };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 16 };
const cardStyle = { textAlign: "left", background: "#101827", color: "#e5edf8", border: "1px solid #233047", borderRadius: 8, padding: 18, cursor: "pointer" };
const labelStyle = { display: "block", color: "#9fb0c7", fontSize: 13, marginBottom: 10 };
const valueStyle = { fontSize: 26, color: "#ffffff" };
const panelStyle = { marginTop: 24, background: "#101827", border: "1px solid #233047", borderRadius: 8, padding: 18 };
const sectionTitle = { margin: "0 0 12px", color: "#f8fafc" };
const alertStyle = { width: "100%", display: "flex", justifyContent: "space-between", gap: 12, background: "#172033", border: "1px solid #334155", color: "#e5edf8", padding: 12, borderRadius: 8, marginBottom: 8, cursor: "pointer" };
const primaryButton = { background: "#2563eb", color: "white", border: 0, borderRadius: 8, padding: "10px 14px", cursor: "pointer" };
const errorStyle = { background: "#451a1a", color: "#fecaca", border: "1px solid #7f1d1d", borderRadius: 8, padding: 12, marginBottom: 16 };
