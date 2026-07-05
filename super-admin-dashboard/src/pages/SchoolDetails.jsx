import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getSchoolDetail } from "../api/platformApi";

export default function SchoolDetails() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { id } = useParams();

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");

        const school = await getSchoolDetail(id);
        setData(school);
      } catch (err) {
        setError(
          err?.response?.data?.detail ||
            err?.message ||
            "Failed to load school data"
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id]);

  if (loading) {
    return (
      <div style={{ padding: 20, color: "#6b7280" }}>
        Loading school data...
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
      {data?.banner_url && (
        <img
          src={data.banner_url}
          alt={`${data.name} banner`}
          style={{ width: "100%", height: 180, objectFit: "cover", borderRadius: 12 }}
        />
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 16, margin: "20px 0" }}>
        {data?.logo_url && (
          <img
            src={data.logo_url}
            alt={`${data.name} logo`}
            style={{ width: 72, height: 72, objectFit: "contain", borderRadius: 12 }}
          />
        )}
        <div>
          <h2 style={{ margin: 0 }}>{data?.name || "School Details"}</h2>
          <p style={{ margin: "6px 0", color: "#64748b" }}>{data?.motto || ""}</p>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
        }}
      >
        <div style={cardStyle}>
          <h4>School Code</h4>
          <h2>{data?.school_code || "Not assigned"}</h2>
        </div>

        <div style={cardStyle}>
          <h4>Operation Type</h4>
          <h2 style={{ textTransform: "capitalize" }}>
            {(data?.operation_type || "day").replaceAll("_", " ")}
          </h2>
        </div>

        <div style={cardStyle}>
          <h4>Users</h4>
          <h2>{data?.users_count ?? 0}</h2>
        </div>
      </div>

      <div style={{ ...cardStyle, marginTop: 16 }}>
        <h4>School Login Link</h4>
        <a href={data?.login_link} target="_blank" rel="noreferrer">
          {data?.login_link || "Not assigned"}
        </a>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
          marginTop: 16,
        }}
      >
        <div style={cardStyle}>
          <h4>Mission</h4>
          <p>{data?.mission || "Not set"}</p>
        </div>
        <div style={cardStyle}>
          <h4>Vision</h4>
          <p>{data?.vision || "Not set"}</p>
        </div>
      </div>
    </div>
  );
}

const cardStyle = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: "12px",
  padding: "16px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
};
