import { useEffect, useState } from "react";
import api, { getPlatformControl } from "../api/platformApi";

export default function PlatformControl() {
  const [data, setData] = useState({});
  const [maintenance, setMaintenance] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    getPlatformControl()
      .then((res) => {
        setData(res || {});
        setMaintenance(Boolean(res?.maintenance_mode));
      })
      .catch((err) => setError(err.message));
  }, []);

  const save = async () => {
    try {
      await api.patch("/platform-control", {
        maintenance_mode: maintenance,
        latest_announcement: announcement,
      });
      setMessage("Platform settings saved");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <h1 style={titleStyle}>Platform Control</h1>
      {error && <div style={errorStyle}>{error}</div>}
      {message && <div style={successStyle}>{message}</div>}
      <div style={gridStyle}>
        <section style={panelStyle}>
          <h2 style={sectionTitle}>Platform Settings</h2>
          <label style={labelStyle}><input type="checkbox" checked={maintenance} onChange={(e) => setMaintenance(e.target.checked)} /> Maintenance Mode</label>
          <textarea style={textareaStyle} placeholder="Global announcement" value={announcement} onChange={(e) => setAnnouncement(e.target.value)} />
          <button style={buttonStyle} onClick={save}>Save Configuration</button>
        </section>
        <section style={panelStyle}><h2 style={sectionTitle}>Subscription Plans</h2><pre style={preStyle}>{JSON.stringify(data.subscription_plans || [], null, 2)}</pre></section>
        <section style={panelStyle}><h2 style={sectionTitle}>Pricing</h2><pre style={preStyle}>{JSON.stringify(data.pricing || {}, null, 2)}</pre></section>
        <section style={panelStyle}><h2 style={sectionTitle}>Feature Flags</h2><pre style={preStyle}>{JSON.stringify(data.feature_flags || {}, null, 2)}</pre></section>
        <section style={panelStyle}><h2 style={sectionTitle}>System Configuration</h2><pre style={preStyle}>{JSON.stringify(data.system_configuration || {}, null, 2)}</pre></section>
        <section style={panelStyle}><h2 style={sectionTitle}>Global Announcements</h2><pre style={preStyle}>{JSON.stringify(data.global_announcements || [], null, 2)}</pre></section>
      </div>
    </div>
  );
}

const titleStyle = { margin: "0 0 18px", color: "#f8fafc" };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 };
const panelStyle = { background: "#101827", border: "1px solid #233047", borderRadius: 8, padding: 16, color: "#e5edf8" };
const sectionTitle = { margin: "0 0 12px", color: "#f8fafc" };
const labelStyle = { display: "block", marginBottom: 12, color: "#cbd5e1" };
const textareaStyle = { width: "100%", boxSizing: "border-box", minHeight: 100, background: "#0b1220", color: "#e5edf8", border: "1px solid #334155", borderRadius: 8, padding: 10, marginBottom: 12 };
const buttonStyle = { background: "#2563eb", color: "white", border: 0, borderRadius: 8, padding: "9px 12px", cursor: "pointer" };
const preStyle = { whiteSpace: "pre-wrap", color: "#cbd5e1", margin: 0 };
const errorStyle = { background: "#451a1a", color: "#fecaca", border: "1px solid #7f1d1d", borderRadius: 8, padding: 12, marginBottom: 16 };
const successStyle = { background: "#064e3b", color: "#bbf7d0", border: "1px solid #047857", borderRadius: 8, padding: 12, marginBottom: 16 };
