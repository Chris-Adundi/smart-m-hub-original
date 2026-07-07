import { useEffect, useState } from "react";
import api, { approveSchool } from "../api/platformApi";

export default function Approvals() {
  const [schools, setSchools] = useState([]);
  const [error, setError] = useState("");

  const load = () => api.get("/schools/pending").then((res) => setSchools(res.data?.schools || [])).catch((err) => setError(err.message));
  useEffect(load, []);

  const approve = async (id) => {
    try {
      await approveSchool(id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <h1 style={titleStyle}>Approvals</h1>
      {error && <div style={errorStyle}>{error}</div>}
      {schools.length === 0 ? <div style={panelStyle}>No pending school approvals.</div> : schools.map((s) => (
        <section key={s.id} style={panelStyle}>
          <h2 style={sectionTitle}>{s.name}</h2>
          <p style={mutedStyle}>{s.school_code} | {s.administrator_email} | {s.payment_status}</p>
          <button style={buttonStyle} onClick={() => approve(s.id)}>Approve School And Users</button>
        </section>
      ))}
    </div>
  );
}

const titleStyle = { margin: "0 0 18px", color: "#f8fafc" };
const panelStyle = { background: "#101827", border: "1px solid #233047", borderRadius: 8, padding: 16, marginBottom: 12, color: "#e5edf8" };
const sectionTitle = { margin: "0 0 8px", color: "#f8fafc" };
const mutedStyle = { color: "#94a3b8" };
const buttonStyle = { background: "#2563eb", color: "white", border: 0, borderRadius: 8, padding: "9px 12px", cursor: "pointer" };
const errorStyle = { background: "#451a1a", color: "#fecaca", border: "1px solid #7f1d1d", borderRadius: 8, padding: 12, marginBottom: 16 };
