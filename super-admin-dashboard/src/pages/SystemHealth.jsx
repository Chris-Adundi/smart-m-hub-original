import { useEffect, useState } from "react";
import api from "../api/platformApi";

export default function SystemHealth() {
  const [health, setHealth] = useState({});
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/system-health").then((res) => setHealth(res.data || {})).catch((err) => setError(err.message));
  }, []);

  const items = [
    ["Database Status", health.database_status],
    ["API Status", health.api_status],
    ["Authentication Status", health.authentication_status],
    ["Server Status", health.server_status],
    ["Platform Status", health.platform_status],
    ["Background Jobs", health.background_jobs],
    ["System Version", health.system_version],
    ["Uptime", health.uptime],
  ];

  return (
    <div>
      <h1 style={titleStyle}>System Health</h1>
      {error && <div style={errorStyle}>{error}</div>}
      <div style={gridStyle}>{items.map(([t, v]) => <button key={t} style={cardStyle}><span>{t}</span><strong>{v || "N/A"}</strong></button>)}</div>
      <section style={panelStyle}><h2 style={sectionTitle}>Alerts</h2><pre style={preStyle}>{JSON.stringify(health.alerts || [], null, 2)}</pre></section>
      <section style={panelStyle}><h2 style={sectionTitle}>Latest Errors</h2><pre style={preStyle}>{JSON.stringify(health.latest_errors || [], null, 2)}</pre></section>
    </div>
  );
}

const titleStyle = { margin: "0 0 18px", color: "#f8fafc" };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14 };
const cardStyle = { background: "#101827", color: "#e5edf8", border: "1px solid #233047", borderRadius: 8, padding: 16, display: "flex", flexDirection: "column", gap: 8, textAlign: "left", cursor: "pointer" };
const panelStyle = { marginTop: 16, background: "#101827", border: "1px solid #233047", borderRadius: 8, padding: 16 };
const sectionTitle = { margin: "0 0 12px", color: "#f8fafc" };
const preStyle = { color: "#cbd5e1", whiteSpace: "pre-wrap" };
const errorStyle = { background: "#451a1a", color: "#fecaca", border: "1px solid #7f1d1d", borderRadius: 8, padding: 12, marginBottom: 16 };
