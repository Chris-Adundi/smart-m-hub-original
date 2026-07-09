import { useEffect, useState } from "react";
import { getDiagnostics, updateDiagnosticStatus } from "../api/platformApi";

const panel = {
  background: "#0f172a",
  border: "1px solid #1e293b",
  borderRadius: "8px",
  padding: "16px",
};

const statusOptions = ["new", "reviewed", "fixed", "ignored"];

export default function DiagnosticsCenter() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [notes, setNotes] = useState({});

  async function load() {
    setLoading(true);
    try {
      const data = await getDiagnostics();
      setRecords(Array.isArray(data?.data) ? data.data : []);
    } catch (error) {
      setMessage(error.message || "Failed to load diagnostics");
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function saveStatus(record, status) {
    try {
      await updateDiagnosticStatus(record.source_id || record.id, {
        status,
        fix_notes: notes[record.source_id || record.id] ?? record.fix_notes ?? "",
      });
      setMessage("Diagnostic updated");
      await load();
    } catch (error) {
      setMessage(error.message || "Failed to update diagnostic");
    }
  }

  return (
    <div style={{ color: "#e5e7eb" }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 28, margin: 0 }}>Error & Diagnostics Center</h1>
        <p style={{ color: "#94a3b8", marginTop: 6 }}>
          Review backend exceptions, failed requests, frontend reports and suggested fixes. File editing is intentionally unavailable.
        </p>
      </div>

      {message && (
        <div style={{ ...panel, marginBottom: 16, color: "#bfdbfe" }}>
          {message}
        </div>
      )}

      {loading ? (
        <div style={panel}>Loading diagnostics...</div>
      ) : records.length === 0 ? (
        <div style={panel}>No diagnostics captured.</div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {records.map((record) => {
            const id = record.source_id || record.id;
            return (
              <div key={id} style={panel}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 18 }}>{record.message || record.action}</h2>
                    <p style={{ color: "#94a3b8", margin: "6px 0 0" }}>
                      {record.route_or_component} | {record.affected_file}
                    </p>
                  </div>
                  <span style={{
                    alignSelf: "flex-start",
                    border: "1px solid #334155",
                    borderRadius: 999,
                    padding: "4px 10px",
                    color: record.severity === "critical" || record.severity === "high" ? "#fecaca" : "#fde68a",
                  }}>
                    {record.severity || "medium"}
                  </span>
                </div>

                <div style={{ color: "#cbd5e1", fontSize: 14, marginTop: 12 }}>
                  <div><strong>Timestamp:</strong> {record.timestamp || "-"}</div>
                  <div><strong>School:</strong> {record.school_id || "Platform"}</div>
                  <div><strong>Suggested fix:</strong> {record.suggested_fix || "-"}</div>
                </div>

                {record.stack_trace && (
                  <pre style={{
                    whiteSpace: "pre-wrap",
                    background: "#020617",
                    border: "1px solid #1e293b",
                    borderRadius: 8,
                    padding: 12,
                    color: "#cbd5e1",
                    maxHeight: 220,
                    overflow: "auto",
                  }}>
                    {record.stack_trace}
                  </pre>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, marginTop: 12 }}>
                  <textarea
                    rows={3}
                    value={notes[id] ?? record.fix_notes ?? ""}
                    onChange={(event) => setNotes((prev) => ({ ...prev, [id]: event.target.value }))}
                    placeholder="Add review notes or fix summary"
                    style={{
                      background: "#020617",
                      color: "#e5e7eb",
                      border: "1px solid #334155",
                      borderRadius: 8,
                      padding: 10,
                    }}
                  />
                  <div style={{ display: "grid", gap: 8 }}>
                    {statusOptions.map((status) => (
                      <button
                        key={status}
                        onClick={() => saveStatus(record, status)}
                        style={{
                          background: record.status === status ? "#2563eb" : "#111827",
                          color: "white",
                          border: "1px solid #334155",
                          borderRadius: 8,
                          padding: "8px 12px",
                          cursor: "pointer",
                        }}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
