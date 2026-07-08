import { useEffect, useState } from "react";
import { getAnalytics } from "../api/platformApi";

export default function Analytics() {
  const [data, setData] = useState({});
  const [error, setError] = useState("");

  useEffect(() => {
    getAnalytics().then(setData).catch((err) => setError(err.message));
  }, []);

  return (
    <div>
      <h1 style={titleStyle}>Analytics</h1>
      {error && <div style={errorStyle}>{error}</div>}
      <div style={gridStyle}>
        {Object.entries(data.system_usage || {}).filter(([, value]) => typeof value !== "object").map(([key, value]) => (
          <button key={key} style={cardStyle}>
            <span>{key.replaceAll("_", " ")}</span>
            <strong>{Number(value || 0).toLocaleString()}</strong>
          </button>
        ))}
      </div>
      <div style={gridStyle}>
        <Chart title="Revenue" rows={data.revenue || []} valueKey="amount" />
        <Chart title="School Growth" rows={data.school_growth || []} valueKey="count" />
        <Chart title="Student Growth" rows={data.student_growth || []} valueKey="count" />
        <Chart title="User Growth" rows={data.user_growth || []} valueKey="count" />
        <Chart title="Support Activity" rows={data.support_activity || []} valueKey="count" />
        <Chart title="Audit Activity" rows={data.audit_activity || []} valueKey="count" />
      </div>
      <section style={panelStyle}>
        <h2 style={sectionTitle}>Most Active Schools</h2>
        <DataTable rows={data.most_active_schools || []} columns={["name", "users", "students", "payments", "support_tickets", "last_login"]} />
      </section>
      <section style={panelStyle}>
        <h2 style={sectionTitle}>Most Active Users</h2>
        <DataTable rows={data.most_active_users || []} columns={["name", "email", "role", "school_id", "last_login"]} />
      </section>
      <section style={panelStyle}>
        <h2 style={sectionTitle}>Status Breakdowns</h2>
        <div style={breakdownGridStyle}>
          {Object.entries(data.status_breakdowns || {}).map(([name, rows]) => (
            <div key={name} style={breakdownStyle}>
              <h3 style={miniTitleStyle}>{name.replaceAll("_", " ")}</h3>
              <DataTable rows={rows || []} columns={["status", "count"]} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Chart({ title, rows, valueKey }) {
  const max = Math.max(...rows.map((r) => Number(r[valueKey] || 0)), 1);
  return (
    <section style={panelStyle}>
      <h2 style={sectionTitle}>{title}</h2>
      <div style={chartStyle}>{rows.map((r) => <button key={r.month} style={{ ...barStyle, height: 30 + (Number(r[valueKey] || 0) / max) * 110 }} title={`${r.month}: ${r[valueKey]}`}>{r.month}</button>)}</div>
    </section>
  );
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
            <tr key={row.id || row.email || row.name || index}>
              {columns.map((column) => <td key={column} style={tdStyle}>{String(row[column] ?? "N/A")}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const titleStyle = { margin: "0 0 18px", color: "#f8fafc" };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 };
const cardStyle = { background: "#101827", border: "1px solid #233047", borderRadius: 8, padding: 16, color: "#9fb0c7", textAlign: "left", display: "flex", flexDirection: "column", gap: 8, cursor: "pointer", marginBottom: 16 };
const panelStyle = { background: "#101827", border: "1px solid #233047", borderRadius: 8, padding: 16, marginBottom: 16 };
const sectionTitle = { margin: "0 0 12px", color: "#f8fafc", fontSize: 18 };
const chartStyle = { display: "flex", alignItems: "end", gap: 8, minHeight: 160, overflowX: "auto" };
const barStyle = { minWidth: 58, background: "#059669", color: "white", border: 0, borderRadius: 6, cursor: "pointer", fontSize: 11 };
const tableStyle = { width: "100%", borderCollapse: "collapse" };
const thStyle = { textAlign: "left", padding: 10, borderBottom: "1px solid #233047", color: "#9fb0c7", textTransform: "capitalize" };
const tdStyle = { padding: 10, borderBottom: "1px solid #1f2a3d", color: "#e5edf8" };
const breakdownGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 };
const breakdownStyle = { border: "1px solid #233047", borderRadius: 8, padding: 12 };
const miniTitleStyle = { color: "#f8fafc", margin: "0 0 8px", textTransform: "capitalize" };
const errorStyle = { background: "#451a1a", color: "#fecaca", border: "1px solid #7f1d1d", borderRadius: 8, padding: 12, marginBottom: 16 };
