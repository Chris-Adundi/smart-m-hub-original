import { useEffect, useState } from "react";
import api from "../api/platformApi";

export default function SupportTickets() {
  const [tickets, setTickets] = useState([]);
  const [selected, setSelected] = useState(null);
  const [reply, setReply] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const load = () => api.get("/support-tickets").then((res) => setTickets(res.data || [])).catch((err) => setError(err.message));
  useEffect(load, []);

  const update = async (ticket, payload) => {
    try {
      await api.patch(`/support-tickets/${ticket.id}`, payload);
      setReply("");
      setNote("");
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const open = tickets.filter((t) => t.status === "open").length;
  const closed = tickets.filter((t) => t.status === "closed").length;
  const high = tickets.filter((t) => t.priority === "high").length;

  return (
    <div>
      <h1 style={titleStyle}>Support</h1>
      {error && <div style={errorStyle}>{error}</div>}
      <div style={gridStyle}><Card title="Open Tickets" value={open} /><Card title="Closed Tickets" value={closed} /><Card title="High Priority Tickets" value={high} /></div>
      <div style={layoutStyle}>
        <section style={panelStyle}>
          {tickets.map((ticket) => <button key={ticket.id} style={ticketStyle} onClick={() => setSelected(ticket)}><strong>{ticket.subject || "Support Ticket"}</strong><span>{ticket.status} | {ticket.priority || "normal"}</span></button>)}
        </section>
        <section style={panelStyle}>
          <h2 style={sectionTitle}>{selected?.subject || "Select Ticket"}</h2>
          {selected && (
            <>
              <p style={mutedStyle}>{selected.message}</p>
              <input style={inputStyle} placeholder="Assign ticket" onBlur={(e) => update(selected, { assigned_to: e.target.value })} />
              <textarea style={textareaStyle} placeholder="Reply" value={reply} onChange={(e) => setReply(e.target.value)} />
              <button style={buttonStyle} onClick={() => update(selected, { reply })}>Send Reply</button>
              <textarea style={textareaStyle} placeholder="Internal note" value={note} onChange={(e) => setNote(e.target.value)} />
              <button style={buttonStyle} onClick={() => update(selected, { internal_note: note })}>Save Note</button>
              <button style={buttonStyle} onClick={() => update(selected, { status: "closed", resolution: "Resolved by platform owner" })}>Resolve</button>
              <pre style={preStyle}>{JSON.stringify({ replies: selected.replies, internal_notes: selected.internal_notes, resolution_history: selected.resolution_history }, null, 2)}</pre>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function Card({ title, value }) { return <div style={cardStyle}><span>{title}</span><strong>{value}</strong></div>; }
const titleStyle = { margin: "0 0 18px", color: "#f8fafc" };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14, marginBottom: 16 };
const cardStyle = { background: "#101827", border: "1px solid #233047", borderRadius: 8, padding: 16, color: "#9fb0c7", display: "flex", flexDirection: "column", gap: 8 };
const layoutStyle = { display: "grid", gridTemplateColumns: "minmax(260px, 380px) 1fr", gap: 16 };
const panelStyle = { background: "#101827", border: "1px solid #233047", borderRadius: 8, padding: 16 };
const ticketStyle = { display: "flex", width: "100%", flexDirection: "column", textAlign: "left", gap: 4, background: "#172033", color: "#e5edf8", border: "1px solid #334155", borderRadius: 8, padding: 12, marginBottom: 8, cursor: "pointer" };
const sectionTitle = { color: "#f8fafc", marginTop: 0 };
const mutedStyle = { color: "#94a3b8" };
const inputStyle = { width: "100%", boxSizing: "border-box", background: "#0b1220", color: "#e5edf8", border: "1px solid #334155", borderRadius: 8, padding: 10, marginBottom: 10 };
const textareaStyle = { ...inputStyle, minHeight: 90 };
const buttonStyle = { background: "#2563eb", color: "white", border: 0, borderRadius: 8, padding: "9px 12px", cursor: "pointer", marginRight: 8, marginBottom: 10 };
const preStyle = { color: "#cbd5e1", whiteSpace: "pre-wrap" };
const errorStyle = { background: "#451a1a", color: "#fecaca", border: "1px solid #7f1d1d", borderRadius: 8, padding: 12, marginBottom: 16 };
