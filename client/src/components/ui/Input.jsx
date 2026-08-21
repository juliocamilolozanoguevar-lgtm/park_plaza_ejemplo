export function Input({ label, error, className = "", id, ...props }) {
  const inputId = id || props.name || props.placeholder;
  return (
    <label className={`block ${className}`} htmlFor={inputId}>
      {label ? <span className="mb-1.5 block text-sm font-semibold text-park-black">{label}</span> : null}
      <input
        id={inputId}
        className={`h-10 w-full rounded-input border bg-white px-3 text-sm text-park-black outline-none transition placeholder:text-park-muted focus:border-park-green focus:ring-2 focus:ring-park-green/15 ${error ? "border-park-danger" : "border-park-border"}`}
        {...props}
      />
      {error ? <span className="mt-1 block text-xs font-semibold text-park-danger">{error}</span> : null}
    </label>
  );
}
