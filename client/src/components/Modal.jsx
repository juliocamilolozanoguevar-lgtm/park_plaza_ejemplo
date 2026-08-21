export function Modal({ open, title, children, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/35 p-3 sm:p-4">
      <div className="max-h-[calc(100vh-1.5rem)] w-full max-w-2xl overflow-y-auto rounded-panel bg-white p-4 shadow-2xl sm:max-h-[calc(100vh-2rem)] sm:p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-black text-park-dark">{title}</h2>
          <button className="rounded-lg px-3 py-1 text-park-muted hover:bg-slate-100" onClick={onClose} type="button">Cerrar</button>
        </div>
        {children}
      </div>
    </div>
  );
}
