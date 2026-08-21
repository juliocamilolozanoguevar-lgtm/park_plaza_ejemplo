import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChefHat, Clock, Eye, PackageCheck, X } from "lucide-react";
import { useLocation } from "react-router-dom";
import { api } from "../../services/api";
import { useFetch } from "../../hooks/useFetch";
import { EmptyState } from "../../components/EmptyState";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { OrderRecipePlan } from "../../components/OrderRecipePlan";
import { StatusBadge } from "../../components/StatusBadge";
import { Toast } from "../../components/Toast";
import { Button, ModuleNav, PageHeader, Select as UiSelect, Tabs } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";

const routeStatus = {
  "/restaurante/pedidos": "PENDIENTE",
  "/restaurante/cocina": "EN_COCINA",
  "/restaurante/preparacion": "PREPARANDO",
  "/restaurante/listos": "LISTO",
  "/restaurante/entregados": "ENTREGADO",
  "/bartender/pendientes": "PENDIENTE",
  "/bartender/preparando": "PREPARANDO",
  "/bartender/entregados": "ENTREGADO"
};

const nextStatus = {
  PENDIENTE: "EN_COCINA",
  EN_COCINA: "PREPARANDO",
  PREPARANDO: "LISTO",
  LISTO: "ENTREGADO"
};

export function OrdersAreaPage({ area }) {
  const { can } = useAuth();
  const canCreate = can(area, "CREAR");
  const canEdit = can(area, "EDITAR");
  const location = useLocation();
  const initialStatus = routeStatus[location.pathname] || (location.pathname.includes("historial") ? "ENTREGADO" : "TODOS");
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const endpoint = area === "BARTENDER" ? "/bartender" : "/restaurante";
  const { data: orders, loading, reload } = useFetch(endpoint, { initialData: [] });
  const { data: products } = useFetch(`/reports/products?area=${area}`, { initialData: [] });
  const [toast, setToast] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [report, setReport] = useState({ type: "FALTA_INSUMO", priority: "MEDIA", description: "", productId: "" });
  const title = area === "BARTENDER" ? "BarTender" : "Restaurante";
  const statusTabs = area === "BARTENDER"
    ? ["TODOS", "PENDIENTE", "PREPARANDO", "LISTO", "ENTREGADO"]
    : ["TODOS", "PENDIENTE", "EN_COCINA", "PREPARANDO", "LISTO", "ENTREGADO"];

  useEffect(() => {
    setStatusFilter(routeStatus[location.pathname] || (location.pathname.includes("historial") ? "ENTREGADO" : "TODOS"));
  }, [location.pathname]);

  const counters = useMemo(() => {
    const list = orders || [];
    return {
      pending: list.filter((item) => item.status === "PENDIENTE").length,
      progress: list.filter((item) => ["EN_COCINA", "PREPARANDO", "LISTO"].includes(item.status)).length,
      delivered: list.filter((item) => item.status === "ENTREGADO").length
    };
  }, [orders]);

  const visibleOrders = useMemo(() => {
    const list = orders || [];
    if (statusFilter === "TODOS") return list;
    return list.filter((item) => item.status === statusFilter);
  }, [orders, statusFilter]);

  async function changeStatus(order, targetStatus) {
    try {
      const updated = await api(`${area === "BARTENDER" ? "/bartender" : "/restaurante"}/${order.id}/status`, {
        method: "PATCH",
        body: { status: targetStatus }
      });
      setToast(`Pedido ${order.code} actualizado.`);
      if (selected?.id === order.id) setSelected(updated);
      reload();
    } catch (error) {
      setToast(error.message || "No se pudo actualizar el pedido.");
      if (error.details) setSelected({ ...order, recipePlan: { ...(order.recipePlan || {}), ...error.details, canPrepare: false } });
    }
  }

  async function submitReport(event) {
    event.preventDefault();
    await api("/reports", { method: "POST", body: { ...report, area, productId: report.type === "FALTA_INSUMO" ? report.productId : null } });
    setToast("Reporte operativo registrado.");
    setReport({ type: "FALTA_INSUMO", priority: "MEDIA", description: "", productId: "" });
    setReportOpen(false);
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-5">
      <Toast message={toast} onClose={() => setToast("")} />
      <PageHeader
        eyebrow={title}
        title="Pedidos"
        description="Gestion operativa del area."
        actions={canCreate ? <Button variant="gold" icon={AlertTriangle} type="button" onClick={() => setReportOpen(true)}>Reportar problema</Button> : null}
      />
      <ModuleNav items={area === "BARTENDER" ? [
        { label: "Pedidos", href: "/bartender/pendientes" },
        { label: "Insumos", href: "/bartender/insumos" },
        { label: "Historial", href: "/bartender/historial" }
      ] : [
        { label: "Pedidos", href: "/restaurante/pedidos" },
        { label: "Produccion", href: "/restaurante/produccion" },
        { label: "Historial", href: "/restaurante/historial" }
      ]} />
      <section className="rounded-card border border-park-border bg-white p-5 shadow-card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-full overflow-x-auto">
            <Tabs tabs={statusTabs.map((item) => ({ value: item, label: item === "TODOS" ? "Todos" : item.replaceAll("_", " ") }))} value={statusFilter} onChange={setStatusFilter} />
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs font-black">
            <Metric label="Pendientes" value={counters.pending} icon={<Clock size={16} />} />
            <Metric label="Proceso" value={counters.progress} icon={<ChefHat size={16} />} />
            <Metric label="Entregados" value={counters.delivered} icon={<PackageCheck size={16} />} />
          </div>
        </div>
      </section>

      {!visibleOrders?.length ? <EmptyState title="Sin pedidos" description="No hay pedidos para este estado." /> : (
        <div className="grid gap-3 xl:grid-cols-2">
          {visibleOrders.map((order) => (
            <article key={order.id} className="rounded-card border border-park-border bg-white p-4 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-black text-park-text">{order.code}</h3>
                  <p className="text-sm text-park-muted">Habitacion {order.roomId || "Piscina"} - S/ {Number(order.total).toFixed(2)}</p>
                </div>
                <StatusBadge value={order.status} />
              </div>
              <div className="mt-4 space-y-2">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <span className="font-bold">{item.quantity} x {item.name}</span>
                    <span>S/ {(Number(item.price) * Number(item.quantity)).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                {canEdit && nextOrderStatus(area, order.status) && order.status !== "LISTO" && (
                  <Button type="button" onClick={() => changeStatus(order, nextOrderStatus(area, order.status))}>
                    {orderActionLabel(area, order.status)}
                  </Button>
                )}
                {canEdit && order.status === "LISTO" && (
                  <Button type="button" variant="gold" onClick={() => changeStatus(order, "ENTREGADO")}>
                    {area === "RESTAURANTE" ? "Confirmar entrega" : "Entregar"}
                  </Button>
                )}
                {order.status === "ENTREGADO" && (
                  <Button type="button" variant="secondary" icon={Eye} onClick={() => setSelected(order)}>Ver detalle</Button>
                )}
                {order.status !== "ENTREGADO" && <Button type="button" variant="secondary" icon={Eye} onClick={() => setSelected(order)}>Ver detalle</Button>}
              </div>
            </article>
          ))}
        </div>
      )}
      {selected ? (
        <OrderDetail
          area={area}
          canEdit={canEdit}
          order={selected}
          onClose={() => setSelected(null)}
          onRequestSupply={(ingredient) => {
            setReport({
              type: "FALTA_INSUMO",
              priority: "ALTA",
              description: `Stock insuficiente para ${ingredient.productName}. Necesario: ${ingredient.required} ${ingredient.unit}. Disponible: ${ingredient.available} ${ingredient.unit}. Pedido: ${selected.code}.`,
              productId: ingredient.productId || ""
            });
            setReportOpen(true);
          }}
          onStatus={changeStatus}
        />
      ) : null}
      {reportOpen && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/30 p-4">
          <form className="w-full max-w-lg rounded-card bg-white p-5 shadow-drawer" onSubmit={submitReport}>
            <div className="mb-4 flex items-center justify-between"><h3 className="font-display text-xl font-semibold text-park-dark">Reportar problema</h3><Button type="button" variant="ghost" onClick={() => setReportOpen(false)}>Cerrar</Button></div>
            <div className="grid gap-3 md:grid-cols-2">
              <Select label="Tipo" value={report.type} onChange={(type) => setReport({ ...report, type })} options={["FALTA_INSUMO", "DANO_EQUIPO", "INCIDENCIA", "OTRO"]} />
              <Select label="Prioridad" value={report.priority} onChange={(priority) => setReport({ ...report, priority })} options={["BAJA", "MEDIA", "ALTA", "CRITICA"]} />
              {report.type === "FALTA_INSUMO" && <label className="block text-xs font-black uppercase text-park-muted md:col-span-2">Producto<select className="mt-1 h-11 w-full rounded-input border border-park-border px-3 text-sm font-normal normal-case text-park-text outline-none focus:border-park-green focus:ring-2 focus:ring-park-green/15" value={report.productId} onChange={(event) => setReport({ ...report, productId: event.target.value })}><option value="">Seleccionar producto</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} - Stock {Number(product.stock)}</option>)}</select></label>}
              <textarea className="min-h-24 rounded-input border border-park-border px-3 py-2 text-sm outline-none transition focus:border-park-green focus:ring-2 focus:ring-park-green/15 md:col-span-2" placeholder="Descripcion" value={report.description} onChange={(event) => setReport({ ...report, description: event.target.value })} required />
            </div>
            <div className="mt-5 flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setReportOpen(false)}>Cancelar</Button><Button>Guardar reporte</Button></div>
          </form>
        </div>
      )}
    </div>
  );
}

function nextOrderStatus(area, status) {
  if (area === "BARTENDER") {
    const flow = { PENDIENTE: "PREPARANDO", PREPARANDO: "LISTO" };
    return flow[status] || null;
  }
  return nextStatus[status] || null;
}

function orderActionLabel(area, status) {
  if (area === "BARTENDER" && status === "PENDIENTE") return "Iniciar preparacion";
  if (area === "RESTAURANTE" && status === "PENDIENTE") return "Aceptar pedido";
  if (area === "RESTAURANTE" && status === "EN_COCINA") return "Iniciar preparacion";
  if (area === "RESTAURANTE" && status === "PREPARANDO") return "Marcar como listo";
  if (status === "PREPARANDO") return "Pasar a LISTO";
  return `Pasar a ${nextOrderStatus(area, status)?.replaceAll("_", " ")}`;
}

function OrderDetail({ area, canEdit, order, onClose, onRequestSupply, onStatus }) {
  const next = nextOrderStatus(area, order.status);
  return (
    <div className="fixed inset-0 z-40 bg-slate-950/30 p-4">
      <aside className="ml-auto h-full max-w-md overflow-auto rounded-card bg-white p-5 shadow-drawer">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase text-park-gold">Detalle del pedido</p>
            <h3 className="font-sans text-xl font-black text-park-black">{order.code}</h3>
          </div>
          <button className="grid h-9 w-9 place-items-center rounded-button border border-park-border text-park-muted hover:text-park-black" onClick={onClose} type="button"><X size={18} /></button>
        </div>
        <div className="mt-4"><StatusBadge value={order.status} /></div>
        <section className="mt-5 rounded-card border border-park-border bg-park-bg p-4">
          <h4 className="mb-3 text-xs font-black uppercase text-park-green">Informacion general</h4>
          <DetailRow label="Habitacion" value={order.stay?.room?.number || order.roomId || "Piscina"} />
          <DetailRow label="Producto" value={order.items?.map((item) => `${item.quantity} x ${item.name}`).join(", ")} />
          <DetailRow label="Total" value={`S/ ${Number(order.total).toFixed(2)}`} />
          <DetailRow label="Recibido" value={formatDateTime(order.createdAt)} />
          <DetailRow label="Actualizado" value={formatDateTime(order.updatedAt)} />
        </section>
        <OrderRecipePlan plan={order.recipePlan} onRequestSupply={onRequestSupply} />
        <section className="mt-4 rounded-card border border-park-border bg-white p-4">
          <h4 className="mb-3 text-xs font-black uppercase text-park-green">Historial del pedido</h4>
          {historyFor(order).map((item) => (
            <div className="flex gap-3 pb-3 last:pb-0" key={item}>
              <span className="mt-1 h-2.5 w-2.5 rounded-full bg-park-green" />
              <p className="text-sm font-semibold text-park-black">{item}</p>
            </div>
          ))}
        </section>
        {canEdit && next ? (
          <div className="mt-5 flex justify-end">
            <Button type="button" onClick={() => onStatus(order, next)}>
              {orderActionLabel(area, order.status)}
            </Button>
          </div>
        ) : null}
      </aside>
    </div>
  );
}

function DetailRow({ label, value }) {
  if (!value) return null;
  return <div className="mb-3 grid grid-cols-[110px_1fr] gap-3 text-sm last:mb-0"><span className="font-semibold text-park-muted">{label}</span><strong className="text-park-black">{value}</strong></div>;
}

function historyFor(order) {
  const steps = ["Pedido recibido"];
  if (["PREPARANDO", "LISTO", "ENTREGADO"].includes(order.status)) steps.push("Preparacion iniciada");
  if (["LISTO", "ENTREGADO"].includes(order.status)) steps.push("Marcado como listo");
  if (order.status === "ENTREGADO") steps.push("Pedido entregado");
  return steps;
}

function formatDateTime(value) {
  if (!value) return null;
  return new Date(value).toLocaleString("es-PE");
}

function Metric({ label, value, icon }) {
  return (
    <div className="rounded-card border border-park-border bg-park-bg px-3 py-2">
      <div className="flex items-center justify-center gap-1 text-park-green">{icon}<span>{value}</span></div>
      <span className="text-park-muted">{label}</span>
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return <UiSelect label={label} value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{option.replaceAll("_", " ")}</option>)}</UiSelect>;
}
