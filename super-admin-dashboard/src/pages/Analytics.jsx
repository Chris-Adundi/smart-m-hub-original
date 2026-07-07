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
        <Chart title="Revenue" rows={data.revenue || []} valueKey="amount" />
        <Chart title="School Growth" rows={data.school_growth || []} valueKey="count" />
        <Chart title="Student Growth" rows={data.student_growth || []} valueKey="count" />
        <Chart title="User Growth" rows={data.user_growth || []} valueKey="count" />
      </div>
      <section style={panelStyle}>
        <h2 style={sectionTitle}>Most Active Schools</h2>
        <pre style={preStyle}>{JSON.stringify(data.most_active_schools || [], null, 2)}</pre>
      </section>
      <section style={panelStyle}>
        <h2 style={sectionTitle}>Most Active Users</h2>
        <pre style={preStyle}>{JSON.stringify(data.most_active_users || [], null, 2)}</pre>
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

const titleStyle = { margin: "0 0 18px", color: "#f8fafc" };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 };
const panelStyle = { background: "#101827", border: "1px solid #233047", borderRadius: 8, padding: 16, marginBottom: 16 };
const sectionTitle = { margin: "0 0 12px", color: "#f8fafc", fontSize: 18 };
const chartStyle = { display: "flex", alignItems: "end", gap: 8, minHeight: 160, overflowX: "auto" };
const barStyle = { minWidth: 58, background: "#059669", color: "white", border: 0, borderRadius: 6, cursor: "pointer", fontSize: 11 };
const preStyle = { color: "#cbd5e1", whiteSpace: "pre-wrap", margin: 0 };
const errorStyle = { background: "#451a1a", color: "#fecaca", border: "1px solid #7f1d1d", borderRadius: 8, padding: 12, marginBottom: 16 };
