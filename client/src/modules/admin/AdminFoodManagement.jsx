import { useMemo, useState } from "react";
import { CheckCircle2, ClipboardList, Edit3, Eye, Package, Plus, Save, X } from "lucide-react";
import { EmptyState } from "../../components/EmptyState";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { StatusBadge } from "../../components/StatusBadge";
import { Toast } from "../../components/Toast";
import { Button, Input, Select, Tabs } from "../../components/ui";
import { api } from "../../services/api";
import { useFetch } from "../../hooks/useFetch";

const emptyRecipe = { id: null, name: "", active: true, items: [{ productId: "", quantity: "", unit: "" }] };

export function AdminFoodManagement({ area, allowProduction = false }) {
  const [tab, setTab] = useState("RECETAS");
  const [recipeForm, setRecipeForm] = useState(emptyRecipe);
  const [selectedWaste, setSelectedWaste] = useState(null);
  const [toast, setToast] = useState("");
  const { data: recipes, loading: recipesLoading, reload: reloadRecipes } = useFetch(`/recipes?area=${area}`, { initialData: [] });
  const { data: products, loading: productsLoading, reload: reloadProducts } = useFetch(`/inventory?area=${area}`, { initialData: [] });
  const { data: requests, loading: requestsLoading, reload: reloadRequests } = useFetch(`/supply-requests?area=${area}`, { initialData: [] });
  const { data: productions, loading: productionsLoading } = useFetch(`/production?area=${area}`, { initialData: [], enabled: allowProduction });
  const { data: movements, loading: movementsLoading } = useFetch(`/inventory/movements?area=${area}`, { initialData: [], enabled: allowProduction });
  const lowStock = useMemo(() => products.filter((item) => item.stockStatus === "STOCK_BAJO" || item.stockStatus === "SIN_STOCK"), [products]);
  const wasteRows = useMemo(() => allowProduction ? buildWasteRows(productions, movements) : [], [allowProduction, productions, movements]);
  const loading = recipesLoading || productsLoading || requestsLoading || (allowProduction && (productionsLoading || movementsLoading));
  const tabs = [
    { value: "RECETAS", label: "Recetas" },
    ...(allowProduction ? [{ value: "PRODUCCION", label: "Produccion" }] : []),
    { value: "INSUMOS", label: "Insumos" },
    ...(allowProduction ? [{ value: "MERMAS", label: "Mermas" }] : []),
    { value: "SOLICITUDES", label: "Solicitudes" }
  ];

  async function saveRecipe(event) {
    event.preventDefault();
    const payload = {
      name: recipeForm.name,
      area,
      active: recipeForm.active,
      items: recipeForm.items.filter((item) => item.productId && Number(item.quantity) > 0)
    };
    if (!payload.items.length) return setToast("Agrega al menos un ingrediente.");
    await api(recipeForm.id ? `/recipes/${recipeForm.id}` : "/recipes", {
      method: recipeForm.id ? "PUT" : "POST",
      body: payload
    });
    setRecipeForm(emptyRecipe);
    setToast(recipeForm.id ? "Receta actualizada." : "Receta creada.");
    reloadRecipes();
  }

  async function toggleRecipe(recipe) {
    await api(`/recipes/${recipe.id}/active`, { method: "PATCH", body: { active: !recipe.active } });
    setToast(recipe.active ? "Receta desactivada." : "Receta activada.");
    reloadRecipes();
  }

  async function updateRequestStatus(request, status) {
    await api(`/supply-requests/${request.id}/status`, { method: "PATCH", body: { status } });
    setToast(`Solicitud #${request.id} actualizada.`);
    reloadRequests();
  }

  function editRecipe(recipe) {
    setRecipeForm({
      id: recipe.id,
      name: recipe.name,
      active: recipe.active,
      items: recipe.items?.length ? recipe.items.map((item) => ({ productId: item.productId, quantity: Number(item.quantity), unit: item.unit })) : emptyRecipe.items
    });
    setTab("RECETAS");
  }

  function updateItem(index, key, value) {
    setRecipeForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const selected = key === "productId" ? products.find((product) => String(product.id) === String(value)) : null;
        return { ...item, [key]: value, unit: selected?.unit || item.unit };
      })
    }));
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-5">
      <Toast message={toast} onClose={() => setToast("")} />
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric icon={ClipboardList} label="Recetas" value={recipes.length} />
        <Metric icon={Package} label="Insumos" value={products.length} />
        <Metric icon={X} label="Stock critico" value={lowStock.length} tone="gold" />
        <Metric icon={CheckCircle2} label="Solicitudes" value={requests.length} />
      </section>
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === "RECETAS" ? (
        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <RecipesTable recipes={recipes} onEdit={editRecipe} onToggle={toggleRecipe} />
          <RecipeForm form={recipeForm} products={products} setForm={setRecipeForm} updateItem={updateItem} onSubmit={saveRecipe} />
        </section>
      ) : null}
      {tab === "INSUMOS" ? <ProductsTable products={products} /> : null}
      {tab === "SOLICITUDES" ? <RequestsTable requests={requests} onStatus={updateRequestStatus} /> : null}
      {tab === "PRODUCCION" ? <ProductionsTable productions={productions} /> : null}
      {tab === "MERMAS" ? <WasteTable rows={wasteRows} onSelect={setSelectedWaste} /> : null}
      {selectedWaste ? <WasteDetailDrawer row={selectedWaste} onClose={() => setSelectedWaste(null)} /> : null}
    </div>
  );
}

function RecipeForm({ form, products, setForm, updateItem, onSubmit }) {
  return (
    <form className="rounded-card border border-park-border bg-white p-5 shadow-card" onSubmit={onSubmit}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-sans text-lg font-black text-park-black">{form.id ? "Editar receta" : "Nueva receta"}</h2>
        {form.id ? <Button icon={X} type="button" variant="secondary" onClick={() => setForm(emptyRecipe)}>Cancelar</Button> : null}
      </div>
      <Input label="Producto final / nombre de receta" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
      <div className="mt-4 space-y-3">
        {form.items.map((item, index) => (
          <div className="grid gap-2 rounded-card border border-park-border bg-park-bg p-3 sm:grid-cols-[1fr_90px_90px_auto]" key={index}>
            <Select label="Ingrediente" value={item.productId} onChange={(event) => updateItem(index, "productId", event.target.value)} required>
              <option value="">Seleccionar</option>
              {products.map((product) => <option key={product.id} value={product.id}>{product.name} ({product.unit})</option>)}
            </Select>
            <Input label="Cantidad" min="0.01" step="0.01" type="number" value={item.quantity} onChange={(event) => updateItem(index, "quantity", event.target.value)} required />
            <Input label="Unidad" value={item.unit} onChange={(event) => updateItem(index, "unit", event.target.value)} required />
            <div className="flex items-end">
              <Button className="w-full" icon={X} type="button" variant="secondary" onClick={() => setForm({ ...form, items: form.items.filter((_, itemIndex) => itemIndex !== index) || emptyRecipe.items })}>Quitar</Button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap justify-between gap-2">
        <Button icon={Plus} type="button" variant="secondary" onClick={() => setForm({ ...form, items: [...form.items, { productId: "", quantity: "", unit: "" }] })}>Agregar ingrediente</Button>
        <Button icon={Save} type="submit">Guardar receta</Button>
      </div>
    </form>
  );
}

function RecipesTable({ recipes, onEdit, onToggle }) {
  if (!recipes.length) return <EmptyState title="Sin recetas" description="Registra recetas para conectar pedidos con inventario." />;
  return (
    <section className="rounded-card border border-park-border bg-white p-5 shadow-card">
      <h2 className="font-sans text-lg font-black text-park-black">Recetas registradas</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-[760px] text-left text-sm">
          <thead className="text-xs uppercase text-park-muted"><tr><th className="py-3">Receta</th><th>Ingredientes</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody className="divide-y divide-park-border">
            {recipes.map((recipe) => (
              <tr key={recipe.id}>
                <td className="py-3 font-black text-park-black">{recipe.name}</td>
                <td>{recipe.items?.map((item) => `${Number(item.quantity)} ${item.unit} ${item.product?.name}`).join(", ") || "-"}</td>
                <td><StatusBadge value={recipe.active ? "ACTIVO" : "INACTIVO"} /></td>
                <td className="flex gap-2 py-3">
                  <Button icon={Edit3} size="sm" type="button" variant="secondary" onClick={() => onEdit(recipe)}>Editar</Button>
                  <Button size="sm" type="button" variant={recipe.active ? "danger" : "secondary"} onClick={() => onToggle(recipe)}>{recipe.active ? "Desactivar" : "Activar"}</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ProductsTable({ products }) {
  if (!products.length) return <EmptyState title="Sin insumos" description="No hay productos registrados para esta area." />;
  return (
    <section className="rounded-card border border-park-border bg-white p-5 shadow-card">
      <div className="overflow-x-auto">
        <table className="min-w-[620px] text-left text-sm">
          <thead className="text-xs uppercase text-park-muted"><tr><th className="py-3">Producto</th><th>Stock</th><th>Unidad</th><th>Categoria</th><th>Estado</th></tr></thead>
          <tbody className="divide-y divide-park-border">
            {products.map((product) => (
              <tr key={product.id}><td className="py-3 font-black text-park-black">{product.name}</td><td>{Number(product.stock)}</td><td>{product.unit}</td><td>{product.category?.name}</td><td><StatusBadge value={product.stockStatus} /></td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RequestsTable({ requests, onStatus }) {
  if (!requests.length) return <EmptyState title="Sin solicitudes" description="Las solicitudes de insumos apareceran aqui." />;
  return (
    <section className="rounded-card border border-park-border bg-white p-5 shadow-card">
      <div className="overflow-x-auto">
        <table className="min-w-[760px] text-left text-sm">
          <thead className="text-xs uppercase text-park-muted"><tr><th className="py-3">Solicitud</th><th>Items</th><th>Notas</th><th>Estado</th><th>Accion</th></tr></thead>
          <tbody className="divide-y divide-park-border">
            {requests.map((request) => (
              <tr key={request.id}>
                <td className="py-3 font-black text-park-black">#{request.id}</td>
                <td>{request.items?.map((item) => `${Number(item.quantity)} ${item.unit} ${item.product?.name}`).join(", ")}</td>
                <td>{request.notes || "-"}</td>
                <td><StatusBadge value={request.status} /></td>
                <td className="flex gap-2 py-3">{request.status === "PENDIENTE" ? <><Button size="sm" type="button" onClick={() => onStatus(request, "APROBADA")}>Aprobar</Button><Button size="sm" type="button" variant="danger" onClick={() => onStatus(request, "RECHAZADA")}>Rechazar</Button></> : request.status === "APROBADA" ? <Button size="sm" type="button" variant="gold" onClick={() => onStatus(request, "ENTREGADA")}>Marcar entregada</Button> : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ProductionsTable({ productions }) {
  if (!productions.length) return <EmptyState title="Sin producciones" description="Las producciones y mermas registradas apareceran aqui." />;
  return (
    <section className="rounded-card border border-park-border bg-white p-5 shadow-card">
      <div className="overflow-x-auto">
        <table className="min-w-[760px] text-left text-sm">
          <thead className="text-xs uppercase text-park-muted"><tr><th className="py-3">Produccion</th><th>Materia prima</th><th>Resultado</th><th>Rendimiento</th><th>Estado</th><th>Fecha</th></tr></thead>
          <tbody className="divide-y divide-park-border">
            {productions.map((item) => (
              <tr key={item.id}><td className="py-3 font-black text-park-black">{item.code}</td><td>{item.inputProduct?.name}<span className="block text-xs text-park-muted">{Number(item.inputQty)} {item.inputProduct?.unit}</span></td><td>{item.outputProduct?.name}<span className="block text-xs text-park-muted">{Number(item.outputQty)} {item.outputProduct?.unit}</span></td><td>{Number(item.yieldPercent).toFixed(1)}%</td><td><StatusBadge value={item.status} /></td><td>{new Date(item.createdAt).toLocaleString("es-PE")}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function WasteTable({ rows, onSelect }) {
  if (!rows.length) return <EmptyState title="Sin mermas" description="Las mermas de produccion u operativas apareceran aqui." />;
  return (
    <section className="rounded-card border border-park-border bg-white p-5 shadow-card">
      <div className="overflow-x-auto">
        <table className="min-w-[760px] text-left text-sm">
          <thead className="text-xs uppercase text-park-muted"><tr><th className="py-3">Producto</th><th>Tipo</th><th>Cantidad</th><th>Responsable</th><th>Fecha</th><th>Origen</th><th>Accion</th></tr></thead>
          <tbody className="divide-y divide-park-border">
            {rows.map((row) => (
              <tr className="cursor-pointer transition hover:bg-park-bg" key={row.id} onClick={() => onSelect(row)}>
                <td className="py-3 font-black text-park-black">{row.productName}</td>
                <td><StatusBadge value={row.type} /></td>
                <td>{formatQty(row.quantity)} {row.unit}</td>
                <td>{row.responsible}</td>
                <td>{formatDateTime(row.createdAt)}</td>
                <td>{row.source === "PRODUCCION" ? row.productionCode : "Kardex"}</td>
                <td><Button icon={Eye} onClick={(event) => { event.stopPropagation(); onSelect(row); }} size="sm" type="button" variant="secondary">Detalle</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function WasteDetailDrawer({ row, onClose }) {
  return (
    <div className="fixed inset-0 z-40 bg-slate-950/30 p-4">
      <aside className="ml-auto h-full max-w-md overflow-auto rounded-card bg-white p-5 shadow-drawer">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase text-park-gold">Detalle de merma</p>
            <h3 className="font-sans text-xl font-black text-park-black">{row.productName}</h3>
          </div>
          <button className="grid h-9 w-9 place-items-center rounded-button border border-park-border text-park-muted hover:text-park-black" onClick={onClose} type="button"><X size={18} /></button>
        </div>
        <div className="mt-3"><StatusBadge value={row.type} /></div>
        <section className="mt-5 rounded-card border border-park-border bg-park-bg p-4">
          <h4 className="mb-3 text-xs font-black uppercase text-park-green">Informacion general</h4>
          <DetailRow label="Cantidad" value={`${formatQty(row.quantity)} ${row.unit}`} />
          <DetailRow label="Origen" value={row.source === "PRODUCCION" ? "Produccion" : "Kardex"} />
          <DetailRow label="Responsable" value={row.responsible} />
          <DetailRow label="Fecha/hora" value={formatDateTime(row.createdAt)} />
          <DetailRow label="Costo" value={`S/ ${Number(row.cost || 0).toFixed(2)}`} />
          <DetailRow label="Motivo" value={row.reason} />
          <DetailRow label="Observacion" value={row.notes} />
          <DetailRow label="Referencia" value={row.reference} />
        </section>
        {row.production ? (
          <section className="mt-4 rounded-card border border-park-border bg-white p-4">
            <h4 className="mb-3 text-xs font-black uppercase text-park-green">Produccion asociada</h4>
            <DetailRow label="Produccion" value={row.production.code} />
            <DetailRow label="Materia prima" value={`${row.production.inputProduct?.name} - ${formatQty(row.production.inputQty)} ${row.production.inputProduct?.unit}`} />
            <DetailRow label="Aprovechable" value={`${row.production.outputProduct?.name} - ${formatQty(row.production.outputQty)} ${row.production.outputProduct?.unit}`} />
            <DetailRow label="Merma" value={`${formatQty(row.production.wasteQty)} ${row.production.inputProduct?.unit}`} />
            <DetailRow label="Rendimiento" value={`${Number(row.production.yieldPercent || 0).toFixed(1)}%`} />
            <DetailRow label="Lote" value={row.production.code} />
          </section>
        ) : null}
      </aside>
    </div>
  );
}

function Metric({ icon: Icon, label, value, tone = "green" }) {
  const styles = tone === "gold" ? "bg-park-gold-soft text-park-gold" : "bg-park-green-soft text-park-green";
  return <article className="rounded-card border border-park-border bg-white p-5 shadow-card"><span className={`grid h-11 w-11 place-items-center rounded-button ${styles}`}><Icon size={20} /></span><p className="mt-4 text-sm font-semibold text-park-muted">{label}</p><strong className="font-display text-2xl text-park-dark">{value}</strong></article>;
}

function DetailRow({ label, value }) {
  if (!value) return null;
  return <div className="mb-3 grid grid-cols-[120px_1fr] gap-3 text-sm last:mb-0"><span className="font-semibold text-park-muted">{label}</span><strong className="text-park-black">{value}</strong></div>;
}

function buildWasteRows(productions, movements) {
  const productionWaste = (productions || [])
    .filter((item) => Number(item.wasteQty) > 0)
    .map((item) => ({
      id: `production-${item.id}`,
      source: "PRODUCCION",
      productId: item.inputProductId,
      productName: item.inputProduct?.name || "Materia prima",
      type: "MERMA_PRODUCCION",
      quantity: Number(item.wasteQty || 0),
      unit: item.inputProduct?.unit || "",
      cost: Number(item.wasteQty || 0) * Number(item.inputProduct?.cost || 0),
      reason: item.notes || `Merma generada por produccion ${item.code}`,
      notes: item.notes,
      reference: item.code,
      responsible: productionUser(item),
      createdAt: item.createdAt,
      productionCode: item.code,
      production: item
    }));

  const operationalWaste = (movements || [])
    .filter((item) => isWasteMovement(item))
    .map((item) => ({
      id: `movement-${item.id}`,
      source: "MOVIMIENTO",
      productId: item.productId,
      productName: item.product?.name || "Producto",
      type: classifyWasteMovement(item),
      quantity: Math.abs(Number(item.quantity || 0)),
      unit: item.product?.unit || "",
      cost: Math.abs(Number(item.quantity || 0)) * Number(item.product?.cost || 0),
      reason: item.reason || "-",
      notes: item.reference,
      reference: item.reference,
      responsible: movementUser(item),
      createdAt: item.createdAt,
      productionCode: null,
      production: null
    }));

  return [...productionWaste, ...operationalWaste].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function isWasteMovement(item) {
  if (item.reference?.includes("PRODUCCION:")) return false;
  const text = [item.reason, item.reference, item.type].filter(Boolean).join(" ").toLowerCase();
  return text.includes("perdida") || text.includes("pérdida") || text.includes("merma") || text.includes("deterioro");
}

function classifyWasteMovement(item) {
  const text = [item.reason, item.reference].filter(Boolean).join(" ").toLowerCase();
  if (text.includes("deterioro") || text.includes("vencid")) return "DETERIORO";
  if (text.includes("merma")) return "MERMA_OPERATIVA";
  return "PERDIDA";
}

function productionUser(item) {
  if (item.createdBy) return `${item.createdBy.firstName} ${item.createdBy.lastName}`;
  return item.createdById ? `Usuario ${item.createdById}` : "Sistema";
}

function movementUser(move) {
  if (move.createdBy) return `${move.createdBy.firstName} ${move.createdBy.lastName}`;
  return move.createdById ? `Usuario ${move.createdById}` : "Sistema";
}

function formatQty(value) {
  return Number(value || 0).toFixed(2);
}

function formatDateTime(value) {
  if (!value) return "No registrado";
  return new Date(value).toLocaleString("es-PE");
}
