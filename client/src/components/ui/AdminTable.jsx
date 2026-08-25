export function AdminTable({ children }) {
  return (
    <div className="overflow-x-auto rounded-card border border-park-border bg-white">
      <table className="w-full text-left text-sm text-park-dark">
        {children}
      </table>
    </div>
  );
}

export function AdminTableHead({ children }) {
  return (
    <thead className="bg-park-bg text-xs font-semibold uppercase text-park-muted">
      <tr>{children}</tr>
    </thead>
  );
}

export function AdminTableRow({ children, onClick, active }) {
  return (
    <tr 
      onClick={onClick}
      className={`border-b border-park-border last:border-0 ${onClick ? "cursor-pointer hover:bg-park-accent-soft/10" : ""} ${active ? "bg-park-accent-soft/20" : ""}`}
    >
      {children}
    </tr>
  );
}

export function AdminTableCell({ children, className = "" }) {
  return (
    <td className={`whitespace-nowrap px-4 py-3 ${className}`}>
      {children}
    </td>
  );
}

export function AdminTableHeaderCell({ children, className = "" }) {
  return (
    <th className={`px-4 py-3 ${className}`}>
      {children}
    </th>
  );
}
