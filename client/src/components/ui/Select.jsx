export function Select({ label, error, className = "", id, children, ...props }) {
  const selectId = id || props.name || label;
  return (
    <label className={`block ${className}`} htmlFor={selectId}>
      {label ? <span className="mb-1.5 block text-sm font-semibold text-park-black">{label}</span> : null}
      <select
        id={selectId}
        className={`h-10 w-full rounded-input border bg-white px-3 text-sm text-park-black outline-none transition focus:border-park-green focus:ring-2 focus:ring-park-green/15 ${error ? "border-park-danger" : "border-park-border"}`}
        {...props}
      >
        {children}
      </select>
      {error ? <span className="mt-1 block text-xs font-semibold text-park-danger">{error}</span> : null}
    </label>
  );
}
