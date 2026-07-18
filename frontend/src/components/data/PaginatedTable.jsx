import { Button } from "@/components/ui/button";
import { EmptyState, LoadingState } from "@/components/ui/state";

export default function PaginatedTable({
  columns = [],
  rows = [],
  loading = false,
  emptyTitle = "No records found",
  pagination,
  onPageChange,
  getRowKey,
}) {
  if (loading) return <LoadingState />;
  if (!rows.length) return <EmptyState title={emptyTitle} />;

  const page = pagination?.page || 1;
  const hasNext = Boolean(pagination?.has_next);

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-md border border-slate-700">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-slate-900 text-slate-300">
            <tr>
              {columns.map((column) => (
                <th key={column.key} scope="col" className="px-3 py-2 text-left font-medium">
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={getRowKey ? getRowKey(row) : row.id || rowIndex} className="border-t border-slate-800">
                {columns.map((column) => (
                  <td key={column.key} className="px-3 py-2 text-slate-200">
                    {column.render ? column.render(row) : row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pagination ? (
        <div className="flex items-center justify-between text-sm text-slate-400">
          <span>Page {page}</span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange?.(page - 1)}>
              Previous
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={!hasNext} onClick={() => onPageChange?.(page + 1)}>
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
