import { useEffect, useState } from "react";
import api from "../api/platformApi";

export default function Payments() {
  const [data, setData] = useState({});
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/payments/summary").then((res) => setData(res.data || {})).catch((err) => setError(err.message));
  }, []);

  const cards = [
    ["Installation Fees", data.installation_fees],
    ["Monthly Subscriptions", data.monthly_subscriptions],
    ["Pending Payments", data.pending_payments],
    ["Overdue Schools", data.overdue_schools],
    ["Total Revenue", data.totalRevenue],
    ["Pending Count", data.pendingPayments],
  ];

  return (
    <div>
      <h1 style={titleStyle}>Payments</h1>
      {error && <div style={errorStyle}>{error}</div>}
      <div style={gridStyle}>{cards.map(([t, v]) => <div key={t} style={cardStyle}><span>{t}</span><strong>{Number(v || 0).toLocaleString()}</strong></div>)}</div>
      <section style={panelStyle}>
        <h2 style={sectionTitle}>Payment History</h2>
        <Table rows={data.payment_history || []} columns={["receipt_number", "school_id", "amount", "status", "created_at"]} />
      </section>
      <section style={panelStyle}>
        <h2 style={sectionTitle}>Revenue Charts</h2>
        <div style={barsStyle}>{(data.revenue_charts || []).map((r) => <button key={r.month} style={{ ...barStyle, height: Math.max(24, Number(r.amount || 0) / 200) }} title={`${r.month}: ${r.amount}`}>{r.month}</button>)}</div>
      </section>
    </div>
  );
}

function Table({ rows, columns }) {
  return <div style={{ overflowX: "auto" }}><table style={tableStyle}><thead><tr>{columns.map((c) => <th style={thStyle} key={c}>{c.replaceAll("_", " ")}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={r.id || i}>{columns.map((c) => <td style={tdStyle} key={c}>{String(r[c] ?? "N/A")}</td>)}</tr>)}</tbody></table></div>;
}

const titleStyle = { margin: "0 0 18px", color: "#f8fafc" };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14 };
const cardStyle = { background: "#101827", border: "1px solid #233047", borderRadius: 8, padding: 16, color: "#9fb0c7", display: "flex", flexDirection: "column", gap: 8 };
const panelStyle = { marginTop: 18, background: "#101827", border: "1px solid #233047", borderRadius: 8, padding: 16 };
const sectionTitle = { margin: "0 0 12px", color: "#f8fafc" };
const tableStyle = { width: "100%", borderCollapse: "collapse" };
const thStyle = { textAlign: "left", padding: 10, borderBottom: "1px solid #233047", color: "#9fb0c7" };
const tdStyle = { padding: 10, borderBottom: "1px solid #1f2a3d", color: "#e5edf8" };
const barsStyle = { display: "flex", alignItems: "end", gap: 8, minHeight: 160 };
const barStyle = { width: 70, background: "#2563eb", color: "white", border: 0, borderRadius: 6, cursor: "pointer" };
const errorStyle = { background: "#451a1a", color: "#fecaca", border: "1px solid #7f1d1d", borderRadius: 8, padding: 12, marginBottom: 16 };
