import { useEffect } from "react";
import { X } from "lucide-react";

export function AdminModal({ open, onClose, title, children, hasUnsavedChanges = false, width = "max-w-xl" }) {
  useEffect(() => {
    function handleEscape(e) {
      if (e.key === "Escape" && open) {
        handleClose();
      }
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, hasUnsavedChanges, onClose]);

  const handleClose = () => {
    if (hasUnsavedChanges) {
      if (!window.confirm("¿Descartar los cambios sin guardar?")) return;
    }
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-park-dark/40 backdrop-blur-sm transition-opacity" 
        onClick={handleClose} 
      />
      <div className={`relative flex max-h-[90vh] w-full flex-col rounded-modal bg-white shadow-modal ${width}`}>
        <div className="flex items-center justify-between border-b border-park-border px-6 py-4">
          <h2 className="text-lg font-semibold text-park-dark">{title}</h2>
          <button 
            onClick={handleClose}
            className="rounded-button p-2 text-park-muted transition-colors hover:bg-park-bg hover:text-park-dark"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
