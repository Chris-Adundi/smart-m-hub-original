import PropTypes from "prop-types";
import { useMemo, useState } from "react";

export default function DataTable({
  title = "Data Table",
  columns = [],
  rows = [],
  loading = false,
  emptyMessage = "No data available",
}) {
  const rowHeight = 48;
  const maxTableHeight = 520;
  const shouldVirtualize = rows.length > 100;
  const [scrollTop, setScrollTop] = useState(0);
  const visibleWindow = useMemo(() => {
    if (!shouldVirtualize) {
      return { start: 0, end: rows.length, top: 0, bottom: 0, rows };
    }
    const visibleCount = Math.ceil(maxTableHeight / rowHeight) + 8;
    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - 4);
    const end = Math.min(rows.length, start + visibleCount);
    return {
      start,
      end,
      top: start * rowHeight,
      bottom: Math.max(0, (rows.length - end) * rowHeight),
      rows: rows.slice(start, end),
    };
  }, [rows, scrollTop, shouldVirtualize]);

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
        <div
          onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
          style={{
            maxHeight: shouldVirtualize ? `${maxTableHeight}px` : "none",
            overflow: "auto",
          }}
        >
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
            {shouldVirtualize && visibleWindow.top > 0 ? (
              <tr aria-hidden="true">
                <td colSpan={columns.length} style={{ height: `${visibleWindow.top}px`, padding: 0, border: 0 }} />
              </tr>
            ) : null}
            {visibleWindow.rows.map((row, rowIndex) => (
              <tr key={visibleWindow.start + rowIndex}>
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
            {shouldVirtualize && visibleWindow.bottom > 0 ? (
              <tr aria-hidden="true">
                <td colSpan={columns.length} style={{ height: `${visibleWindow.bottom}px`, padding: 0, border: 0 }} />
              </tr>
            ) : null}
          </tbody>
        </table>
        </div>
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
