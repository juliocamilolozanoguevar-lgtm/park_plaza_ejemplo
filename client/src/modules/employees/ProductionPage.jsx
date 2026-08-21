import { useMemo, useState } from "react";
import { Factory, Leaf, PackageCheck, Percent, Scale } from "lucide-react";
import { EmptyState } from "../../components/EmptyState";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { StatusBadge } from "../../components/StatusBadge";
import { Toast } from "../../components/Toast";
import { Button, Input, ModuleNav, PageHeader, Select, Tabs } from "../../components/ui";
import { api } from "../../services/api";
import { useFetch } from "../../hooks/useFetch";

const emptyForm = { inputProductId: "", outputProductId: "", inputQty: "", outputQty: "", notes: "" };

export function ProductionPage({ area = "RESTAURANTE", admin = false }) {
  const [form, setForm] = useState(emptyForm);
  const [productionTab, setProductionTab] = useState("PREPARACIONES");
  const [toast, setToast] = useState("");
  const { data: products, loading: productsLoading, reload: reloadProducts } = useFetch(`/inventory?area=${area}`, { initialData: [] });
  const { data: productions, loading, reload } = useFetch(`/production?area=${area}`, { initialData: [] });
  const { data: summary, reload: reloadSummary } = useFetch(`/production/summary?area=${area}`, { initialData: { total: 0, totalInput: 0, totalOutput: 0, totalWaste: 0, yieldPercent: 0 } });
  const inputProduct = useMemo(() => products.find((item) => String(item.id) === String(form.inputProductId)), [products, form.inputProductId]);
  const outputProduct = useMemo(() => products.find((item) => String(item.id) === String(form.outputProductId)), [products, form.outputProductId]);
  const waste = Math.max(0, Number(form.inputQty || 0) - Number(form.outputQty || 0));
  const yieldPercent = Number(form.inputQty || 0) > 0 ? (Number(form.outputQty || 0) / Number(form.inputQty || 0)) * 100 : 0;

  async function submit(event) {
    event.preventDefault();
    try {
      await api("/production", { method: "POST", body: form });
      setToast("Produccion registrada. Inventario y Kardex actualizados.");
      setForm(emptyForm);
      await Promise.all([reload(), reloadSummary(), reloadProducts()]);
    } catch (error) {
      setToast(error.message || "No se pudo registrar la produccion.");
    }
  }

  if (loading || productsLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-5">
      <Toast message={toast} onClose={() => setToast("")} />
      <PageHeader
        eyebrow={admin ? "Administrador / Cocina" : "Cocina"}
        title="Produccion"
        description="Transforma materia prima en producto aprovechable y registra merma automaticamente."
      />
      <ModuleNav items={admin ? [
        { label: "Resumen", href: "/admin/restaurante/resumen" },
        { label: "Pedidos", href: "/admin/restaurante/pedidos" },
        { label: "Gestion", href: "/admin/restaurante/gestion" },
        { label: "Produccion", href: "/admin/restaurante/produccion" },
        { label: "Historial y reportes", href: "/admin/restaurante/reportes" },
        { label: "Incidencias", href: "/admin/restaurante/incidencias" }
      ] : [
        { label: "Pedidos", href: "/restaurante/pedidos" },
        { label: "Produccion", href: "/restaurante/produccion" },
        { label: "Historial", href: "/restaurante/historial" }
      ]} />
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Factory} label="Producciones" value={summary.total || 0} />
        <Metric icon={Scale} label="Materia prima usada" value={formatQty(summary.totalInput)} />
        <Metric icon={Leaf} label="Merma registrada" value={formatQty(summary.totalWaste)} tone="gold" />
        <Metric icon={Percent} label="Rendimiento" value={`${Number(summary.yieldPercent || 0).toFixed(1)}%`} />
      </section>
      {!admin ? <Tabs tabs={[
        { value: "PREPARACIONES", label: "Preparaciones" },
        { value: "MERMAS", label: "Mermas" },
        { value: "INSUMOS", label: "Insumos" }
      ]} value={productionTab} onChange={setProductionTab} /> : null}
      {(admin || productionTab === "PREPARACIONES") ? <section className="rounded-card border border-park-border bg-white p-5 shadow-card">
        <h2 className="font-sans text-lg font-black text-park-black">Nueva produccion</h2>
        <form className="mt-4 grid gap-3 lg:grid-cols-5" onSubmit={submit}>
          <Select label="Materia prima" value={form.inputProductId} onChange={(event) => setForm({ ...form, inputProductId: event.target.value })} required>
            <option value="">Seleccionar</option>
            {products.map((product) => <option key={product.id} value={product.id}>{product.name} - Stock {Number(product.stock)} {product.unit}</option>)}
          </Select>
          <Select label="Producto obtenido" value={form.outputProductId} onChange={(event) => setForm({ ...form, outputProductId: event.target.value })} required>
            <option value="">Seleccionar</option>
            {products.map((product) => <option key={product.id} value={product.id}>{product.name} - {product.unit}</option>)}
          </Select>
          <Input label={`Cantidad usada${inputProduct ? ` (${inputProduct.unit})` : ""}`} min="0.01" step="0.01" type="number" value={form.inputQty} onChange={(event) => setForm({ ...form, inputQty: event.target.value })} required />
          <Input label={`Cantidad obtenida${outputProduct ? ` (${outputProduct.unit})` : ""}`} min="0.01" step="0.01" type="number" value={form.outputQty} onChange={(event) => setForm({ ...form, outputQty: event.target.value })} required />
          <Input label="Observacion" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
          <div className="lg:col-span-5 flex flex-wrap items-center justify-between gap-3 rounded-card bg-park-bg p-3">
            <p className="text-sm font-semibold text-park-muted">Merma calculada: <b className="text-park-black">{waste.toFixed(2)}</b> | Rendimiento: <b className="text-park-green">{yieldPercent.toFixed(1)}%</b></p>
            <Button icon={PackageCheck} type="submit">Registrar produccion</Button>
          </div>
        </form>
      </section> : null}
      {(admin || productionTab === "PREPARACIONES") ? <section className="rounded-card border border-park-border bg-white p-5 shadow-card">
        <h2 className="font-sans text-lg font-black text-park-black">Historial de produccion</h2>
        {!productions.length ? <EmptyState title="Sin producciones" description="Aun no hay transformaciones registradas." /> : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-[860px] text-left text-sm">
              <thead className="text-xs uppercase text-park-muted"><tr><th className="py-3">Codigo</th><th>Materia prima</th><th>Usado</th><th>Obtenido</th><th>Merma</th><th>Rendimiento</th><th>Fecha</th><th>Estado</th></tr></thead>
              <tbody className="divide-y divide-park-border">
                {productions.map((item) => (
                  <tr key={item.id}>
                    <td className="py-3 font-black text-park-black">{item.code}</td>
                    <td>{item.inputProduct?.name} {"->"} {item.outputProduct?.name}</td>
                    <td>{Number(item.inputQty)} {item.inputProduct?.unit}</td>
                    <td>{Number(item.outputQty)} {item.outputProduct?.unit}</td>
                    <td className="font-black text-park-gold">{Number(item.wasteQty)} {item.inputProduct?.unit}</td>
                    <td>{Number(item.yieldPercent).toFixed(1)}%</td>
                    <td>{new Date(item.createdAt).toLocaleString("es-PE")}</td>
                    <td><StatusBadge value={item.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section> : null}
      {!admin && productionTab === "MERMAS" ? <WasteTable productions={productions} /> : null}
      {!admin && productionTab === "INSUMOS" ? <ProductsTable products={products} /> : null}
    </div>
  );
}

function WasteTable({ productions }) {
  const rows = productions.filter((item) => Number(item.wasteQty) > 0);
  if (!rows.length) return <EmptyState title="Sin mermas" description="Las mermas de produccion apareceran aqui." />;
  return (
    <section className="rounded-card border border-park-border bg-white p-5 shadow-card">
      <h2 className="font-sans text-lg font-black text-park-black">Mermas de produccion</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-[760px] text-left text-sm">
          <thead className="text-xs uppercase text-park-muted"><tr><th className="py-3">Produccion</th><th>Materia prima</th><th>Merma</th><th>Rendimiento</th><th>Fecha</th></tr></thead>
          <tbody className="divide-y divide-park-border">
            {rows.map((item) => <tr key={item.id}><td className="py-3 font-black text-park-black">{item.code}</td><td>{item.inputProduct?.name}</td><td className="font-black text-park-gold">{Number(item.wasteQty)} {item.inputProduct?.unit}</td><td>{Number(item.yieldPercent).toFixed(1)}%</td><td>{new Date(item.createdAt).toLocaleString("es-PE")}</td></tr>)}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ProductsTable({ products }) {
  if (!products.length) return <EmptyState title="Sin insumos" description="No hay productos de cocina registrados." />;
  return (
    <section className="rounded-card border border-park-border bg-white p-5 shadow-card">
      <h2 className="font-sans text-lg font-black text-park-black">Insumos de cocina</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-[760px] text-left text-sm">
          <thead className="text-xs uppercase text-park-muted"><tr><th className="py-3">Producto</th><th>Categoria</th><th>Stock</th><th>Minimo</th><th>Estado</th></tr></thead>
          <tbody className="divide-y divide-park-border">
            {products.map((product) => <tr key={product.id}><td className="py-3 font-black text-park-black">{product.name}</td><td>{product.category?.name}</td><td>{Number(product.stock)} {product.unit}</td><td>{Number(product.minStock)} {product.unit}</td><td><StatusBadge value={product.stockStatus} /></td></tr>)}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Metric({ icon: Icon, label, value, tone = "green" }) {
  const styles = tone === "gold" ? "bg-park-gold-soft text-park-gold" : "bg-park-green-soft text-park-green";
  return <article className="rounded-card border border-park-border bg-white p-5 shadow-card"><span className={`grid h-11 w-11 place-items-center rounded-button ${styles}`}><Icon size={20} /></span><p className="mt-4 text-sm font-semibold text-park-muted">{label}</p><strong className="font-display text-2xl text-park-dark">{value}</strong></article>;
}

function formatQty(value) {
  return Number(value || 0).toFixed(2);
}
