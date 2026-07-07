import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { activateSchool, approveSchool, getSchoolDetail, resetSchoolPassword, suspendSchool } from "../api/platformApi";

export default function SchoolDetails() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const { id } = useParams();

  const load = async () => {
    try {
      setData(await getSchoolDetail(id));
      setError("");
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const run = async (fn) => {
    try {
      await fn(id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  if (error) return <div style={errorStyle}>{error}</div>;
  if (!data) return <div style={mutedStyle}>Loading school profile...</div>;

  const sections = [
    ["General Information", data.general_information],
    ["Branding", data.branding],
    ["Subscription", data.subscription],
    ["Students", data.students],
    ["Staff", data.staff],
    ["Finance Summary", data.finance_summary],
    ["System Usage", data.system_usage],
    ["Login History", data.login_history],
    ["API Usage", data.api_usage],
    ["Storage Usage", data.storage_usage],
    ["Support Tickets", data.support_tickets],
    ["Audit Logs", data.audit_logs],
    ["Recent Activities", data.recent_activities],
  ];

  return (
    <div>
      <div style={heroStyle}>
        {data.logo_url && <img src={data.logo_url} alt="" style={logoStyle} />}
        <div>
          <h1 style={titleStyle}>{data.name}</h1>
          <p style={mutedStyle}>{data.school_code} | {data.approval_status} | {data.subscription_status}</p>
        </div>
        <div style={actionsStyle}>
          <button style={primaryButton} onClick={() => run(approveSchool)}>Approve</button>
          <button style={buttonStyle} onClick={() => run(suspendSchool)}>Suspend</button>
          <button style={buttonStyle} onClick={() => run(activateSchool)}>Activate</button>
          <button style={buttonStyle} onClick={() => run(resetSchoolPassword)}>Reset Password</button>
        </div>
      </div>

      <div id="statistics" style={statsGrid}>
        <Metric title="Students" value={data.students?.count || 0} />
        <Metric title="Staff" value={data.staff?.count || 0} />
        <Metric title="Paid Revenue" value={`KES ${Number(data.finance_summary?.paid || 0).toLocaleString()}`} />
        <Metric title="Outstanding" value={`KES ${Number(data.finance_summary?.outstanding || 0).toLocaleString()}`} />
      </div>

      <div style={sectionGrid}>
        {sections.map(([title, value]) => (
          <section key={title} id={title === "Staff" ? "users" : undefined} style={panelStyle}>
            <h2 style={sectionTitle}>{title}</h2>
            <pre style={preStyle}>{JSON.stringify(value || {}, null, 2)}</pre>
          </section>
        ))}
      </div>
    </div>
  );
}

function Metric({ title, value }) {
  return <div style={metricStyle}><span>{title}</span><strong>{value}</strong></div>;
}

const heroStyle = { display: "flex", alignItems: "center", gap: 16, background: "#101827", border: "1px solid #233047", borderRadius: 8, padding: 18, marginBottom: 16, flexWrap: "wrap" };
const logoStyle = { width: 72, height: 72, borderRadius: 8, objectFit: "cover", background: "#0b1220" };
const titleStyle = { margin: 0, color: "#f8fafc" };
const mutedStyle = { color: "#94a3b8", margin: "6px 0 0" };
const actionsStyle = { display: "flex", gap: 8, flexWrap: "wrap", marginLeft: "auto" };
const primaryButton = { background: "#2563eb", color: "white", border: 0, borderRadius: 8, padding: "9px 12px", cursor: "pointer" };
const buttonStyle = { background: "#172033", color: "#dbeafe", border: "1px solid #334155", borderRadius: 8, padding: "9px 12px", cursor: "pointer" };
const statsGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 16 };
const metricStyle = { background: "#101827", border: "1px solid #233047", borderRadius: 8, padding: 16, display: "flex", flexDirection: "column", gap: 8, color: "#9fb0c7" };
const sectionGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16 };
const panelStyle = { background: "#101827", border: "1px solid #233047", borderRadius: 8, padding: 16, minHeight: 180 };
const sectionTitle = { color: "#f8fafc", margin: "0 0 10px", fontSize: 17 };
const preStyle = { whiteSpace: "pre-wrap", wordBreak: "break-word", color: "#cbd5e1", fontSize: 12, margin: 0 };
const errorStyle = { background: "#451a1a", color: "#fecaca", border: "1px solid #7f1d1d", borderRadius: 8, padding: 12 };
