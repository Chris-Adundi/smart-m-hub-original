import PropTypes from "prop-types";

export default function StatCard({
  title,
  value,
  icon = null,
  color = "#2563eb",
}) {
  return (
    <div
      style={{
        padding: "16px",
        borderRadius: "12px",
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
        minWidth: "180px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {icon && <span style={{ color }}>{icon}</span>}

        <h4
          style={{
            margin: 0,
            fontSize: "13px",
            fontWeight: 500,
            color: "#6b7280",
          }}
        >
          {title}
        </h4>
      </div>

      <h2
        style={{
          margin: 0,
          fontSize: "22px",
          fontWeight: 700,
          color: "#111827",
        }}
      >
        {value}
      </h2>
    </div>
  );
}

StatCard.propTypes = {
  title: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  icon: PropTypes.node,
  color: PropTypes.string,
};