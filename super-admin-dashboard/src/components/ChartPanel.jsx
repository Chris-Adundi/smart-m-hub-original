import PropTypes from "prop-types";

export default function ChartPanel({
  title = "Analytics",
  subtitle = "",
  children,
  height = 350,
}) {
  return (
    <div
      style={{
        background: "#ffffff",
        borderRadius: "12px",
        padding: "20px",
        boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
        border: "1px solid #e5e7eb",
      }}
    >
      <div style={{ marginBottom: "16px" }}>
        <h3
          style={{
            margin: 0,
            fontSize: "18px",
            fontWeight: 600,
            color: "#111827",
          }}
        >
          {title}
        </h3>

        {subtitle && (
          <p
            style={{
              margin: "6px 0 0",
              color: "#6b7280",
              fontSize: "14px",
            }}
          >
            {subtitle}
          </p>
        )}
      </div>

      <div
        style={{
          minHeight: `${height}px`,
          display: "flex",
          alignItems: "center",
          justifyContent: children ? "stretch" : "center",
          width: "100%",
        }}
      >
        {children || (
          <div
            style={{
              color: "#9ca3af",
              fontSize: "14px",
              textAlign: "center",
            }}
          >
            No chart data available.
          </div>
        )}
      </div>
    </div>
  );
}

ChartPanel.propTypes = {
  title: PropTypes.string,
  subtitle: PropTypes.string,
  children: PropTypes.node,
  height: PropTypes.number,
};