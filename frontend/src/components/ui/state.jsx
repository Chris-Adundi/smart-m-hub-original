export function LoadingState({ label = "Loading..." }) {
  return <div className="p-6 text-slate-400" role="status">{label}</div>;
}

export function EmptyState({ title = "No records found", detail }) {
  return (
    <div className="p-6 text-center text-slate-400">
      <p className="font-medium text-slate-200">{title}</p>
      {detail ? <p className="text-sm mt-1">{detail}</p> : null}
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", detail, onRetry }) {
  return (
    <div className="p-6 text-center text-red-300" role="alert">
      <p className="font-medium">{title}</p>
      {detail ? <p className="text-sm mt-1 text-red-200">{detail}</p> : null}
      {onRetry ? (
        <button type="button" className="mt-3 rounded border border-red-400 px-3 py-1 text-sm" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}
