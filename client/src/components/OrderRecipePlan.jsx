import { ClipboardPlus } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { Button } from "./ui";

export function OrderRecipePlan({ plan, onRequestSupply }) {
  if (!plan) return null;
  const hasProblems = !plan.canPrepare;
  return (
    <section className={`mt-4 rounded-card border p-4 ${hasProblems ? "border-park-danger/30 bg-park-danger-soft/40" : "border-park-green-soft bg-white"}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h4 className="text-xs font-black uppercase text-park-green">Receta / ingredientes</h4>
        <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${hasProblems ? "bg-park-danger-soft text-park-danger" : "bg-park-green-soft text-park-green"}`}>
          {hasProblems ? "Revisar stock" : "Disponible"}
        </span>
      </div>
      {plan.missingRecipes?.length ? (
        <div className="mb-3 rounded-button bg-white p-3 text-sm font-semibold text-park-danger">
          Falta configurar receta para: {plan.missingRecipes.map((item) => item.name).join(", ")}
        </div>
      ) : null}
      {plan.issues?.length ? (
        <div className="mb-3 rounded-button bg-white p-3 text-sm font-semibold text-park-danger">
          Hay unidades incompatibles entre receta e inventario.
        </div>
      ) : null}
      {plan.requirements?.length ? (
        <div className="space-y-2">
          {plan.requirements.map((item) => (
            <div className="rounded-button border border-park-border bg-white px-3 py-2 text-sm" key={item.productId}>
              <div className="flex items-center justify-between gap-3">
                <strong className="text-park-black">{item.productName}</strong>
                <StatusBadge value={item.enough ? item.stockStatus : "SIN_STOCK"} />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-park-muted">
                <span>Necesario: <b className="text-park-black">{item.required} {item.unit}</b></span>
                <span>Disponible: <b className={item.enough ? "text-park-green" : "text-park-danger"}>{item.available} {item.unit}</b></span>
              </div>
              {item.sources?.length ? <p className="mt-1 text-[11px] text-park-muted">{item.sources.join(", ")}</p> : null}
              {!item.enough && onRequestSupply ? (
                <div className="mt-3 flex justify-end">
                  <Button icon={ClipboardPlus} size="sm" type="button" variant="secondary" onClick={() => onRequestSupply(item)}>
                    Solicitar insumo
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-park-muted">Este pedido no tiene ingredientes calculados.</p>
      )}
    </section>
  );
}
