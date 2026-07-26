import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { activateSchool, approveSchool, deleteSchool, getSchools, resetSchoolPassword, suspendSchool } from "../api/platformApi";

export default function Schools() {
  const [schools, setSchools] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const load = async () => {
    try {
      const res = await getSchools({ page, limit: 50, search: search.trim() });
      setSchools(res.schools || []);
      setPages(res.pages || 1);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(load, 300);
    return () => window.clearTimeout(timer);
  }, [page, search]);

  const run = async (action) => {
    try {
      await action();
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const confirmDelete = async (school) => {
    const confirmation = window.prompt(`Delete ${school.name}? Type the exact school name to confirm. This immediately revokes every tenant account.`);
    if (confirmation !== school.name) {
      if (confirmation !== null) setError("School name did not match. Nothing was deleted.");
      return;
    }
    await run(() => deleteSchool(school.id));
  };

  return (
    <div>
      <div style={headerStyle}>
        <div>
          <h1 style={titleStyle}>Schools</h1>
          <p style={mutedStyle}>Search, approve, suspend, activate, bill and inspect all tenant schools.</p>
        </div>
        <input style={inputStyle} placeholder="Search schools..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>

      {error && <div style={errorStyle}>{error}</div>}

      <div style={tableWrap}>
        <table style={tableStyle}>
          <thead>
            <tr>
              {["Logo", "School Name", "Code", "Type", "Administrator", "Subscription", "Registered", "Last Login", "Payment", "Status", "Actions"].map((h) => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {schools.map((s) => (
              <tr key={s.id}>
                <td style={tdStyle}>{s.logo_url ? <img src={s.logo_url} alt="" style={logoStyle} /> : <span style={avatarStyle}>{(s.name || "S").slice(0, 1)}</span>}</td>
                <td style={tdStyle}>{s.name}</td>
                <td style={tdStyle}>{s.school_code || "Pending"}</td>
                <td style={tdStyle}>{s.school_type || "N/A"}</td>
                <td style={tdStyle}>{s.administrator || "N/A"}</td>
                <td style={tdStyle}>{s.current_subscription} / {s.subscription_status}</td>
                <td style={tdStyle}>{formatDate(s.registration_date)}</td>
                <td style={tdStyle}>{formatDate(s.last_login)}</td>
                <td style={tdStyle}>{s.payment_status}</td>
                <td style={tdStyle}>{s.school_status}</td>
                <td style={tdStyle}>
                  <div style={actionsStyle}>
                    <button style={buttonStyle} onClick={() => navigate(`/schools/${s.id}`)}>View</button>
                    <button style={buttonStyle} onClick={() => run(() => approveSchool(s.id))}>Approve</button>
                    <button style={buttonStyle} onClick={() => run(() => suspendSchool(s.id))}>Suspend</button>
                    <button style={buttonStyle} onClick={() => run(() => activateSchool(s.id))}>Activate</button>
                    <button style={buttonStyle} onClick={() => run(() => resetSchoolPassword(s.id))}>Reset Password</button>
                    <button style={buttonStyle} onClick={() => navigate(`/payments?school=${s.id}`)}>Billing</button>
                    <button style={buttonStyle} onClick={() => navigate(`/schools/${s.id}#users`)}>View Users</button>
                    <button style={buttonStyle} onClick={() => navigate(`/schools/${s.id}#statistics`)}>View Statistics</button>
                    <button style={dangerButtonStyle} onClick={() => confirmDelete(s)}>Delete School</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={paginationStyle}>
        <button style={buttonStyle} disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>
        <span>Page {page} of {pages}</span>
        <button style={buttonStyle} disabled={page >= pages} onClick={() => setPage((value) => Math.min(pages, value + 1))}>Next</button>
      </div>
    </div>
  );
}

const formatDate = (value) => (value ? new Date(value).toLocaleDateString() : "N/A");
const headerStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 18 };
const titleStyle = { margin: 0, color: "#f8fafc" };
const mutedStyle = { color: "#94a3b8", margin: "6px 0 0" };
const inputStyle = { width: 300, maxWidth: "100%", background: "#0b1220", border: "1px solid #334155", color: "#e5edf8", borderRadius: 8, padding: "10px 12px" };
const tableWrap = { overflowX: "auto", background: "#101827", border: "1px solid #233047", borderRadius: 8 };
const tableStyle = { width: "100%", borderCollapse: "collapse", minWidth: 1250 };
const thStyle = { textAlign: "left", padding: 12, color: "#9fb0c7", fontSize: 12, borderBottom: "1px solid #233047" };
const tdStyle = { padding: 12, borderBottom: "1px solid #1f2a3d", color: "#e5edf8", fontSize: 13, verticalAlign: "top" };
const logoStyle = { width: 34, height: 34, borderRadius: 6, objectFit: "cover" };
const avatarStyle = { width: 34, height: 34, borderRadius: 6, background: "#1d4ed8", display: "inline-flex", alignItems: "center", justifyContent: "center" };
const actionsStyle = { display: "flex", flexWrap: "wrap", gap: 6, minWidth: 360 };
const buttonStyle = { background: "#172033", color: "#dbeafe", border: "1px solid #334155", borderRadius: 6, padding: "6px 8px", cursor: "pointer", fontSize: 12 };
const dangerButtonStyle = { ...buttonStyle, background: "#451a1a", color: "#fecaca", borderColor: "#7f1d1d" };
const paginationStyle = { display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12, color: "#cbd5e1", marginTop: 14 };
const errorStyle = { background: "#451a1a", color: "#fecaca", border: "1px solid #7f1d1d", borderRadius: 8, padding: 12, marginBottom: 16 };
