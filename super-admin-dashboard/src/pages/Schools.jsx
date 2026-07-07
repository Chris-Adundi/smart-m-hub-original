import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { activateSchool, approveSchool, getSchools, resetSchoolPassword, suspendSchool } from "../api/platformApi";

export default function Schools() {
  const [schools, setSchools] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const load = async () => {
    try {
      const res = await getSchools();
      setSchools(res.schools || []);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return schools.filter((s) =>
      [s.name, s.school_code, s.administrator, s.email].some((value) =>
        String(value || "").toLowerCase().includes(q)
      )
    );
  }, [schools, search]);

  const run = async (action) => {
    try {
      await action();
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <div style={headerStyle}>
        <div>
          <h1 style={titleStyle}>Schools</h1>
          <p style={mutedStyle}>Search, approve, suspend, activate, bill and inspect all tenant schools.</p>
        </div>
        <input style={inputStyle} placeholder="Search schools..." value={search} onChange={(e) => setSearch(e.target.value)} />
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
            {filtered.map((s) => (
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
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
const errorStyle = { background: "#451a1a", color: "#fecaca", border: "1px solid #7f1d1d", borderRadius: 8, padding: 12, marginBottom: 16 };
