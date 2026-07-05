import { useEffect, useState } from "react";
import api from "../api/platformApi";

export default function SupportTickets() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadTickets() {
      try {
        setLoading(true);

        const res = await api.get("/support-tickets");

        setTickets(res.data || []);
      } catch (err) {
        setError(
          err?.response?.data?.detail ||
          err?.message ||
          "Failed to load tickets"
        );
      } finally {
        setLoading(false);
      }
    }

    loadTickets();
  }, []);

  if (loading) {
    return <div>Loading support tickets...</div>;
  }

  if (error) {
    return (
      <div style={{ color: "red" }}>
        {error}
      </div>
    );
  }

  return (
    <div>
      <h2>Support Tickets</h2>

      {tickets.length === 0 ? (
        <p>No tickets found.</p>
      ) : (
        tickets.map((ticket) => (
          <div
            key={ticket.id}
            style={{
              border: "1px solid #ddd",
              padding: "12px",
              marginBottom: "10px",
              borderRadius: "8px",
              background: "#fff",
            }}
          >
            <div>
              <strong>Status:</strong> {ticket.status}
            </div>

            <div>
              <strong>Message:</strong> {ticket.message}
            </div>

            <div>
              <strong>School:</strong> {ticket.school_id}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
