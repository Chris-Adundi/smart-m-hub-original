import PropTypes from "prop-types";

export default function DataTable({
  title = "Data Table",
  columns = [],
  rows = [],
  loading = false,
  emptyMessage = "No data available",
}) {
  return (
    <div
      style={{
        background: "#ffffff",
        borderRadius: "12px",
        padding: "20px",
        boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
        border: "1px solid #e5e7eb",
        overflowX: "auto",
      }}
    >
      <h3
        style={{
          margin: "0 0 16px 0",
          fontSize: "18px",
          fontWeight: 600,
          color: "#111827",
        }}
      >
        {title}
      </h3>

      {loading ? (
        <div style={{ padding: "20px", color: "#6b7280" }}>Loading...</div>
      ) : rows.length === 0 ? (
        <div style={{ padding: "20px", color: "#9ca3af" }}>
          {emptyMessage}
        </div>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            minWidth: "600px",
          }}
        >
          <thead>
            <tr>
              {columns.map((col, index) => (
                <th
                  key={index}
                  style={{
                    textAlign: "left",
                    padding: "12px",
                    borderBottom: "1px solid #e5e7eb",
                    fontSize: "14px",
                    color: "#374151",
                    fontWeight: 600,
                  }}
                >
                  {col.header || col.accessor}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {columns.map((col, colIndex) => (
                  <td
                    key={colIndex}
                    style={{
                      padding: "12px",
                      borderBottom: "1px solid #f3f4f6",
                      fontSize: "14px",
                      color: "#111827",
                    }}
                  >
                    {typeof col.cell === "function"
                      ? col.cell(row)
                      : row[col.accessor]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

DataTable.propTypes = {
  title: PropTypes.string,
  columns: PropTypes.array,
  rows: PropTypes.array,
  loading: PropTypes.bool,
  emptyMessage: PropTypes.string,
};