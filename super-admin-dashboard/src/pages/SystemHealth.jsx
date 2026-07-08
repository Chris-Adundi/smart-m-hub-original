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
    ["Open Support Tickets", health.open_support_tickets],
    ["Audit Events", health.audit_events],
    ["Storage Used", `${health.storage_usage?.used_mb || 0} MB`],
    ["System Version", health.system_version],
    ["Uptime", health.uptime],
  ];

  return (
    <div>
      <h1 style={titleStyle}>System Health</h1>
      {error && <div style={errorStyle}>{error}</div>}
      <div style={gridStyle}>{items.map(([t, v]) => <button key={t} style={cardStyle}><span>{t}</span><strong>{v || "N/A"}</strong></button>)}</div>
      <section style={panelStyle}>
        <h2 style={sectionTitle}>Background Jobs</h2>
        <DataTable rows={objectRows(health.background_jobs)} columns={["name", "value"]} />
      </section>
      <section style={panelStyle}>
        <h2 style={sectionTitle}>Collections</h2>
        <DataTable rows={objectRows(health.collections)} columns={["name", "value"]} />
      </section>
      <section style={panelStyle}>
        <h2 style={sectionTitle}>Alerts</h2>
        <DataTable rows={health.alerts || []} columns={["type", "message"]} />
      </section>
      <section style={panelStyle}>
        <h2 style={sectionTitle}>Latest Security/Error Events</h2>
        <DataTable rows={health.latest_errors || []} columns={["action", "performed_by", "school_id", "timestamp"]} />
      </section>
    </div>
  );
}

function objectRows(value = {}) {
  return Object.entries(value || {}).map(([name, rowValue]) => ({ name: name.replaceAll("_", " "), value: rowValue }));
}

function DataTable({ rows, columns }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={tableStyle}>
        <thead>
          <tr>{columns.map((column) => <th key={column} style={thStyle}>{column.replaceAll("_", " ")}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td style={tdStyle} colSpan={columns.length}>No data available</td></tr>}
          {rows.map((row, index) => (
            <tr key={row.id || row.name || index}>
              {columns.map((column) => <td key={column} style={tdStyle}>{String(row[column] ?? "N/A")}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const titleStyle = { margin: "0 0 18px", color: "#f8fafc" };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14 };
const cardStyle = { background: "#101827", color: "#e5edf8", border: "1px solid #233047", borderRadius: 8, padding: 16, display: "flex", flexDirection: "column", gap: 8, textAlign: "left", cursor: "pointer" };
const panelStyle = { marginTop: 16, background: "#101827", border: "1px solid #233047", borderRadius: 8, padding: 16 };
const sectionTitle = { margin: "0 0 12px", color: "#f8fafc" };
const tableStyle = { width: "100%", borderCollapse: "collapse" };
const thStyle = { textAlign: "left", padding: 10, borderBottom: "1px solid #233047", color: "#9fb0c7", textTransform: "capitalize" };
const tdStyle = { padding: 10, borderBottom: "1px solid #1f2a3d", color: "#e5edf8" };
const errorStyle = { background: "#451a1a", color: "#fecaca", border: "1px solid #7f1d1d", borderRadius: 8, padding: 12, marginBottom: 16 };
