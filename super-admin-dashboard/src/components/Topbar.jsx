export default function Topbar() {
  return (
    <div
      style={{
        height: "60px",
        borderBottom: "1px solid #e5e7eb",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 20px",
        background: "#ffffff",
      }}
    >
      <div
        style={{
          fontSize: "16px",
          fontWeight: 600,
          color: "#111827",
        }}
      >
        Platform Control Center
      </div>

      <span
        style={{
          fontSize: "14px",
          color: "#6b7280",
        }}
      >
        Admin
      </span>
    </div>
  );
}