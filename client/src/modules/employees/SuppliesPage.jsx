import { useMemo, useState } from "react";
import { AlertTriangle, ClipboardPlus, PackageSearch } from "lucide-react";
import { EmptyState } from "../../components/EmptyState";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { StatusBadge } from "../../components/StatusBadge";
import { Toast } from "../../components/Toast";
import { Button, Input, ModuleNav, PageHeader, Select } from "../../components/ui";
import { api } from "../../services/api";
import { useFetch } from "../../hooks/useFetch";

export function SuppliesPage({ area }) {
  const [search, setSearch] = useState("");
  const [action, setAction] = useState({ type: "", productId: "", quantity: "", reason: "", notes: "" });
  const [toast, setToast] = useState("");
  const { data: products, loading, reload } = useFetch(`/inventory?area=${area}`, { initialData: [] });
  const visible = useMemo(() => products.filter((product) => product.name.toLowerCase().includes(search.trim().toLowerCase())), [products, search]);
  const selected = products.find((product) => String(product.id) === String(action.productId));

  async function submit(event) {
    event.preventDefault();
    if (action.type === "REQUEST") {
      await api("/supply-requests", {
        method: "POST",
        body: { area, notes: action.notes, items: [{ productId: action.productId, quantity: action.quantity, unit: selected?.unit || "" }] }
      });
      setToast("Solicitud de insumo registrada.");
    }
    if (action.type === "LOSS") {
      await api("/inventory/losses", {
        method: "POST",
        body: { productId: action.productId, quantity: action.quantity, reason: action.reason, reference: `${area}-PERDIDA` }
      });
      setToast("Perdida registrada en Kardex.");
      reload();
    }
    setAction({ type: "", productId: "", quantity: "", reason: "", notes: "" });
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-5">
      <Toast message={toast} onClose={() => setToast("")} />
      <PageHeader eyebrow={area === "BARTENDER" ? "Bartender" : "Restaurante"} title="Insumos" description="Consulta stock, solicita insumos y reporta perdidas excepcionales." />
      <ModuleNav items={area === "BARTENDER" ? [
        { label: "Pedidos", href: "/bartender/pendientes" },
        { label: "Insumos", href: "/bartender/insumos" },
        { label: "Historial", href: "/bartender/entregados" }
      ] : [
        { label: "Pedidos", href: "/restaurante/pedidos" },
        { label: "Produccion", href: "/restaurante/produccion" },
        { label: "Insumos", href: "/restaurante/insumos" },
        { label: "Historial", href: "/restaurante/entregados" }
      ]} />
      <section className="rounded-card border border-park-border bg-white p-4 shadow-card">
        <Input label="Buscar insumo" placeholder="Producto..." value={search} onChange={(event) => setSearch(event.target.value)} />
      </section>
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="rounded-card border border-park-border bg-white p-5 shadow-card">
          {!visible.length ? <EmptyState title="Sin insumos" description="No hay productos para esta busqueda." /> : (
            <div className="overflow-x-auto">
              <table className="min-w-[720px] text-left text-sm">
                <thead className="text-xs uppercase text-park-muted"><tr><th className="py-3">Producto</th><th>Categoria</th><th>Stock</th><th>Minimo</th><th>Estado</th><th>Acciones</th></tr></thead>
                <tbody className="divide-y divide-park-border">
                  {visible.map((product) => (
                    <tr key={product.id}>
                      <td className="py-3 font-black text-park-black">{product.name}</td>
                      <td>{product.category?.name}</td>
                      <td>{Number(product.stock)} {product.unit}</td>
                      <td>{Number(product.minStock)} {product.unit}</td>
                      <td><StatusBadge value={product.stockStatus} /></td>
                      <td className="flex gap-2 py-3"><Button icon={ClipboardPlus} size="sm" type="button" variant="secondary" onClick={() => setAction({ type: "REQUEST", productId: product.id, quantity: "", reason: "", notes: "" })}>Solicitar</Button><Button icon={AlertTriangle} size="sm" type="button" variant="gold" onClick={() => setAction({ type: "LOSS", productId: product.id, quantity: "", reason: "", notes: "" })}>Perdida</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <form className="rounded-card border border-park-border bg-white p-5 shadow-card" onSubmit={submit}>
          <h2 className="font-sans text-lg font-black text-park-black">{action.type === "LOSS" ? "Reportar perdida" : "Solicitar insumo"}</h2>
          <p className="mt-1 text-sm text-park-muted">Las solicitudes no modifican stock. Las perdidas generan salida de inventario.</p>
          <div className="mt-4 grid gap-3">
            <Select label="Producto" value={action.productId} onChange={(event) => setAction({ ...action, productId: event.target.value })} required>
              <option value="">Seleccionar</option>
              {products.map((product) => <option key={product.id} value={product.id}>{product.name} - Stock {Number(product.stock)} {product.unit}</option>)}
            </Select>
            <Input label={`Cantidad${selected ? ` (${selected.unit})` : ""}`} min="0.01" step="0.01" type="number" value={action.quantity} onChange={(event) => setAction({ ...action, quantity: event.target.value })} required />
            {action.type === "LOSS" ? <Input label="Motivo" value={action.reason} onChange={(event) => setAction({ ...action, reason: event.target.value })} required /> : <Input label="Nota" value={action.notes} onChange={(event) => setAction({ ...action, notes: event.target.value })} />}
            <Button icon={PackageSearch} type="submit" disabled={!action.type}>{action.type === "LOSS" ? "Registrar perdida" : "Crear solicitud"}</Button>
          </div>
        </form>
      </section>
    </div>
  );
}
