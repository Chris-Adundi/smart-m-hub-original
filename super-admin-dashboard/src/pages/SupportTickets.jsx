import { useEffect, useMemo, useState } from "react";
import api from "../api/platformApi";

const emptyTicket = {
  school_id: "",
  subject: "",
  message: "",
  priority: "normal",
  assigned_to: "",
};

export default function SupportTickets() {
  const [tickets, setTickets] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [reply, setReply] = useState("");
  const [note, setNote] = useState("");
  const [draft, setDraft] = useState(emptyTicket);
  const [filter, setFilter] = useState("open");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/support-tickets");
      const list = Array.isArray(data) ? data : [];
      setTickets(list);
      setSelectedId((current) => current || list[0]?.id || "");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const selected = tickets.find((ticket) => ticket.id === selectedId) || null;

  const visibleTickets = useMemo(() => {
    if (filter === "all") return tickets;
    if (filter === "high") return tickets.filter((ticket) => ticket.priority === "high");
    return tickets.filter((ticket) => (ticket.status || "open") === filter);
  }, [tickets, filter]);

  const metrics = useMemo(() => ({
    open: tickets.filter((ticket) => (ticket.status || "open") === "open").length,
    closed: tickets.filter((ticket) => ticket.status === "closed").length,
    high: tickets.filter((ticket) => ticket.priority === "high").length,
  }), [tickets]);

  const update = async (ticket, payload) => {
    if (!ticket) return;
    setBusy(true);
    setError("");
    try {
      await api.patch(`/support-tickets/${ticket.id}`, payload);
      setReply("");
      setNote("");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const createTicket = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post("/support-tickets", draft);
      setDraft(emptyTicket);
      await load();
      setSelectedId(data?.ticket?.id || "");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div style={headerStyle}>
        <div>
          <h1 style={titleStyle}>Support</h1>
          <p style={mutedStyle}>Track open tickets, assign ownership, reply to schools and keep internal resolution notes.</p>
        </div>
        <button style={secondaryButtonStyle} onClick={load} disabled={loading}>Refresh</button>
      </div>

      {error && <div style={errorStyle}>{error}</div>}

      <div style={gridStyle}>
        <button style={cardStyle} onClick={() => setFilter("open")}><span>Open Tickets</span><strong>{metrics.open}</strong></button>
        <button style={cardStyle} onClick={() => setFilter("closed")}><span>Closed Tickets</span><strong>{metrics.closed}</strong></button>
        <button style={cardStyle} onClick={() => setFilter("high")}><span>High Priority</span><strong>{metrics.high}</strong></button>
      </div>

      <div style={layoutStyle}>
        <section style={panelStyle}>
          <div style={listHeaderStyle}>
            <h2 style={sectionTitle}>Queue</h2>
            <select style={selectStyle} value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
              <option value="high">High priority</option>
              <option value="all">All tickets</option>
            </select>
          </div>

          {loading ? (
            <div style={emptyStyle}>Loading support tickets...</div>
          ) : visibleTickets.length === 0 ? (
            <div style={emptyStyle}>No tickets in this queue.</div>
          ) : visibleTickets.map((ticket) => (
            <button
              key={ticket.id}
              style={{ ...ticketStyle, borderColor: ticket.id === selectedId ? "#38bdf8" : "#334155" }}
              onClick={() => setSelectedId(ticket.id)}
            >
              <strong>{ticket.subject || "Support Ticket"}</strong>
              <span>{ticket.school_id || "Platform"} | {formatDate(ticket.created_at)}</span>
              <span><Badge value={ticket.status || "open"} /> <Badge value={ticket.priority || "normal"} /></span>
            </button>
          ))}
        </section>

        <section style={panelStyle}>
          <h2 style={sectionTitle}>{selected?.subject || "Ticket Details"}</h2>
          {selected ? (
            <>
              <div style={metaGridStyle}>
                <Detail label="School" value={selected.school_id || "Platform"} />
                <Detail label="Assigned" value={selected.assigned_to || "Unassigned"} />
                <Detail label="Status" value={selected.status || "open"} />
                <Detail label="Priority" value={selected.priority || "normal"} />
              </div>

              <p style={messageStyle}>{selected.message || "No message supplied."}</p>

              <div style={inlineFormStyle}>
                <input
                  style={inputStyle}
                  placeholder="Assign ticket"
                  defaultValue={selected.assigned_to || ""}
                  onBlur={(event) => event.target.value !== selected.assigned_to && update(selected, { assigned_to: event.target.value })}
                />
                <select
                  style={selectStyle}
                  value={selected.priority || "normal"}
                  onChange={(event) => update(selected, { priority: event.target.value })}
                >
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              <textarea style={textareaStyle} placeholder="Reply to school" value={reply} onChange={(event) => setReply(event.target.value)} />
              <button style={buttonStyle} onClick={() => update(selected, { reply })} disabled={busy || !reply.trim()}>Send Reply</button>

              <textarea style={textareaStyle} placeholder="Internal note" value={note} onChange={(event) => setNote(event.target.value)} />
              <button style={secondaryButtonStyle} onClick={() => update(selected, { internal_note: note })} disabled={busy || !note.trim()}>Save Note</button>
              <button style={selected.status === "closed" ? buttonStyle : dangerButtonStyle} onClick={() => update(selected, selected.status === "closed" ? { status: "open" } : { status: "closed", resolution: "Resolved by platform owner" })} disabled={busy}>
                {selected.status === "closed" ? "Reopen" : "Resolve"}
              </button>

              <History title="Replies" items={selected.replies} empty="No replies yet." textKey="message" />
              <History title="Internal Notes" items={selected.internal_notes} empty="No internal notes yet." textKey="note" />
              <History title="Resolution History" items={selected.resolution_history} empty="No resolution history yet." textKey="resolution" />
            </>
          ) : (
            <div style={emptyStyle}>Select a ticket to manage it.</div>
          )}
        </section>

        <section style={panelStyle}>
          <h2 style={sectionTitle}>New Ticket</h2>
          <form onSubmit={createTicket}>
            <input style={inputStyle} placeholder="School ID or code" value={draft.school_id} onChange={(event) => setDraft({ ...draft, school_id: event.target.value })} />
            <input style={inputStyle} placeholder="Subject" value={draft.subject} onChange={(event) => setDraft({ ...draft, subject: event.target.value })} required />
            <textarea style={textareaStyle} placeholder="Message" value={draft.message} onChange={(event) => setDraft({ ...draft, message: event.target.value })} required />
            <select style={selectStyle} value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value })}>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
            <input style={inputStyle} placeholder="Assign to" value={draft.assigned_to} onChange={(event) => setDraft({ ...draft, assigned_to: event.target.value })} />
            <button style={buttonStyle} disabled={busy}>Create Ticket</button>
          </form>
        </section>
      </div>
    </div>
  );
}

function Detail({ label, value }) {
  return <div style={detailStyle}><span>{label}</span><strong>{value}</strong></div>;
}

function Badge({ value }) {
  const tone = value === "closed" ? "#14532d" : value === "critical" ? "#7f1d1d" : value === "high" ? "#713f12" : "#1e3a8a";
  return <span style={{ ...badgeStyle, background: tone }}>{value}</span>;
}

function History({ title, items, empty, textKey }) {
  const rows = Array.isArray(items) ? items : [];
  return (
    <div style={historyStyle}>
      <h3 style={historyTitleStyle}>{title}</h3>
      {rows.length === 0 ? <p style={mutedStyle}>{empty}</p> : rows.map((item, index) => (
        <div key={`${title}-${index}`} style={historyItemStyle}>
          <p>{item[textKey]}</p>
          <span>{item.by || "System"} | {formatDate(item.created_at)}</span>
        </div>
      ))}
    </div>
  );
}

function formatDate(value) {
  if (!value) return "No date";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value).slice(0, 16) : date.toLocaleString();
}

const titleStyle = { margin: "0 0 8px", color: "#f8fafc" };
const headerStyle = { display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", marginBottom: 18 };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14, marginBottom: 16 };
const cardStyle = { background: "#101827", border: "1px solid #233047", borderRadius: 8, padding: 16, color: "#9fb0c7", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" };
const layoutStyle = { display: "grid", gridTemplateColumns: "minmax(260px, 360px) minmax(360px, 1fr) minmax(260px, 320px)", gap: 16, alignItems: "start" };
const panelStyle = { background: "#101827", border: "1px solid #233047", borderRadius: 8, padding: 16, color: "#e5edf8" };
const listHeaderStyle = { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 12 };
const ticketStyle = { display: "flex", width: "100%", flexDirection: "column", textAlign: "left", gap: 7, background: "#172033", color: "#e5edf8", border: "1px solid #334155", borderRadius: 8, padding: 12, marginBottom: 8, cursor: "pointer" };
const sectionTitle = { color: "#f8fafc", margin: 0 };
const mutedStyle = { color: "#94a3b8", margin: 0 };
const inputStyle = { width: "100%", boxSizing: "border-box", background: "#0b1220", color: "#e5edf8", border: "1px solid #334155", borderRadius: 8, padding: 10, marginBottom: 10 };
const textareaStyle = { ...inputStyle, minHeight: 94, resize: "vertical" };
const selectStyle = { ...inputStyle };
const buttonStyle = { background: "#2563eb", color: "white", border: 0, borderRadius: 8, padding: "9px 12px", cursor: "pointer", marginRight: 8, marginBottom: 10 };
const secondaryButtonStyle = { background: "#172033", color: "#dbe7f3", border: "1px solid #334155", borderRadius: 8, padding: "9px 12px", cursor: "pointer", marginRight: 8, marginBottom: 10 };
const dangerButtonStyle = { background: "#7f1d1d", color: "#fee2e2", border: "1px solid #991b1b", borderRadius: 8, padding: "9px 12px", cursor: "pointer", marginRight: 8, marginBottom: 10 };
const metaGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, margin: "14px 0" };
const detailStyle = { background: "#0b1220", border: "1px solid #233047", borderRadius: 8, padding: 10, display: "flex", flexDirection: "column", gap: 4 };
const messageStyle = { color: "#dbe7f3", background: "#0b1220", border: "1px solid #233047", borderRadius: 8, padding: 12, lineHeight: 1.5 };
const inlineFormStyle = { display: "grid", gridTemplateColumns: "1fr 150px", gap: 10 };
const historyStyle = { borderTop: "1px solid #233047", marginTop: 14, paddingTop: 12 };
const historyTitleStyle = { color: "#dbe7f3", fontSize: 14, margin: "0 0 8px" };
const historyItemStyle = { background: "#0b1220", border: "1px solid #233047", borderRadius: 8, padding: 10, marginBottom: 8, color: "#dbe7f3" };
const badgeStyle = { color: "#f8fafc", borderRadius: 999, padding: "3px 8px", fontSize: 12, textTransform: "capitalize", marginRight: 4 };
const emptyStyle = { color: "#94a3b8", padding: 20, textAlign: "center" };
const errorStyle = { background: "#451a1a", color: "#fecaca", border: "1px solid #7f1d1d", borderRadius: 8, padding: 12, marginBottom: 16 };
