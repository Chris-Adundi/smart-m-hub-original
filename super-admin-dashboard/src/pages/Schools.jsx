import { useEffect, useState } from "react";
import { getSchools } from "../api/platformApi";
import { useNavigate } from "react-router-dom";

export default function Schools() {
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");

        const res = await getSchools();
        setSchools(res?.schools || []);
      } catch (err) {
        setError(err?.message || "Failed to load schools");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 20, color: "#6b7280" }}>
        Loading schools...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 20, color: "red" }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{ padding: 10 }}>
      <h2 style={{ marginBottom: 20 }}>All Schools</h2>

      {schools.length === 0 ? (
        <div style={{ color: "#9ca3af" }}>
          No schools found
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: "10px",
              overflow: "hidden",
            }}
          >
            <thead>
              <tr style={{ background: "#f9fafb" }}>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>School Code</th>
                <th style={thStyle}>Operation</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Created</th>
                <th style={thStyle}>Action</th>
              </tr>
            </thead>

            <tbody>
              {schools.map((s) => (
                <tr key={s.id}>
                  <td style={tdStyle}>{s.name}</td>
                  <td style={tdStyle}>{s.school_code || "Not assigned"}</td>
                  <td style={{ ...tdStyle, textTransform: "capitalize" }}>
                    {(s.operation_type || "day").replaceAll("_", " ")}
                  </td>

                  <td style={tdStyle}>
                    {s.is_active ? (
                      <span style={{ color: "green", fontWeight: 500 }}>
                        Active
                      </span>
                    ) : (
                      <span style={{ color: "red", fontWeight: 500 }}>
                        Inactive
                      </span>
                    )}
                  </td>

                  <td style={tdStyle}>{s.created_at || "N/A"}</td>

                  <td style={tdStyle}>
                    <button
                      onClick={() => navigate(`/schools/${s.id}`)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: "6px",
                        border: "1px solid #e5e7eb",
                        cursor: "pointer",
                        background: "#2563eb",
                        color: "white",
                      }}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const thStyle = {
  textAlign: "left",
  padding: "12px",
  borderBottom: "1px solid #e5e7eb",
  fontSize: "14px",
};

const tdStyle = {
  padding: "12px",
  borderBottom: "1px solid #f3f4f6",
  fontSize: "14px",
};
