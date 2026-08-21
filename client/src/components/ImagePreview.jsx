import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { getImageUrl } from "../services/api";

export function ImagePreview({ alt = "Imagen", className = "", path, src }) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const url = getImageUrl(src || path);

  useEffect(() => {
    setFailed(false);
  }, [url]);

  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(event) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!url || failed) {
    return <div className={`${className} grid place-items-center rounded-card border border-dashed border-park-border bg-park-bg text-center text-xs font-semibold text-park-muted`}>Imagen no disponible</div>;
  }

  return (
    <>
      <button className={`${className} overflow-hidden rounded-card border border-park-border bg-park-bg`} onClick={() => setOpen(true)} type="button">
        <img className="h-full w-full object-cover" src={url} alt={alt} onError={() => setFailed(true)} />
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 p-3" onMouseDown={() => setOpen(false)}>
          <div className="relative max-h-[92vh] w-full max-w-5xl" onMouseDown={(event) => event.stopPropagation()}>
            <button className="absolute right-2 top-2 z-10 grid h-9 w-9 place-items-center rounded-button bg-white text-park-black shadow-card" onClick={() => setOpen(false)} type="button" aria-label="Cerrar imagen">
              <X size={18} />
            </button>
            <img className="max-h-[92vh] w-full rounded-card bg-white object-contain" src={url} alt={alt} onError={() => setFailed(true)} />
          </div>
        </div>
      ) : null}
    </>
  );
}
