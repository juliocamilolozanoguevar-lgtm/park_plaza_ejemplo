import { EmptyState } from "./EmptyState";

export function Table({ columns, rows, renderRow }) {
  if (!rows?.length) {
    return <EmptyState />;
  }

  return (
    <div className="max-w-full overflow-x-auto rounded-card border border-park-border bg-white shadow-card">
      <table className="min-w-[720px] text-left font-body text-sm">
        <thead className="bg-park-bg text-xs uppercase text-park-muted">
          <tr>
            {columns.map((column) => (
              <th className="px-4 py-3 font-black" key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-park-border/70">{rows.map(renderRow)}</tbody>
      </table>
    </div>
  );
}
