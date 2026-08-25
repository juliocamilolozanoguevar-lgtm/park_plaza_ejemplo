import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChefHat, Clock, Eye, MapPin, PackageCheck, Scale, Wine, X } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Alert, Button, ModuleNav, PageHeader, Tabs } from "../../components/ui";
import { EmptyState } from "../../components/EmptyState";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { OrderRecipePlan } from "../../components/OrderRecipePlan";
import { StatusBadge } from "../../components/StatusBadge";
import { Toast } from "../../components/Toast";
import { useAuth } from "../../context/AuthContext";
import { useFetch } from "../../hooks/useFetch";
import { api } from "../../services/api";

const routeStatus = {
  "/restaurante/pedidos": "PENDIENTE",
  "/restaurante/preparacion": "PREPARANDO",
  "/restaurante/listos": "LISTO",
  "/restaurante/entregados": "ENTREGADO",
  "/bartender/pendientes": "PENDIENTE",
  "/bartender/preparando": "PREPARANDO",
  "/bartender/entregados": "ENTREGADO"
};

const activeStatuses = new Set(["PENDIENTE", "EN_COCINA", "PREPARANDO", "LISTO"]);

export function OrdersAreaPage({ area, embedded = false }) {
  const { can } = useAuth();
  const canEdit = can(area, "EDITAR");
  const location = useLocation();
  const isBar = area === "BARTENDER";
  const routeView = viewFromStatus(routeStatus[location.pathname] || (location.pathname.includes("historial") ? "ENTREGADO" : null));
  const [view, setView] = useState(routeView || "ACTIVOS");
  const [toast, setToast] = useState("");
  const [failure, setFailure] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [cancelOrder, setCancelOrder] = useState(null);
  const { data: orders = [], loading, reload } = useFetch(isBar ? "/bartender" : "/restaurante", { initialData: [] });
  const Icon = isBar ? Wine : ChefHat;
  const list = Array.isArray(orders) ? orders : [];

  useEffect(() => {
    if (routeView) setView(routeView);
  }, [routeView]);

  const filtered = useMemo(() => {
    const sorted = [...list].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    if (view === "ACTIVOS") return sorted.filter((order) => activeStatuses.has(order.status));
    if (view === "RECIBIDOS") return sorted.filter((order) => order.status === "PENDIENTE");
    if (view === "PREPARANDO") return sorted.filter((order) => ["EN_COCINA", "PREPARANDO"].includes(order.status));
    if (view === "LISTOS") return sorted.filter((order) => order.status === "LISTO");
    if (view === "ENTREGADOS") return sorted.filter((order) => order.status === "ENTREGADO");
    return sorted;
  }, [list, view]);

  async function changeStatus(order, target) {
    setBusyId(order.id);
    setFailure("");
    try {
      const updated = await api(`${isBar ? "/bartender" : "/restaurante"}/${order.id}/status`, {
        method: "PATCH",
        body: { status: target }
      });
      setToast(toastMessage(order, target));
      if (selected?.id === order.id) setSelected(updated);
      await reload();
    } catch (error) {
      setFailure(error.message || "No se pudo actualizar el pedido.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <LoadingSpinner />;

  const active = list.filter((order) => activeStatuses.has(order.status));

  return (
    <div className="space-y-5">
      <Toast message={toast} onClose={() => setToast("")} />
      {!embedded ? (
        <>
          <PageHeader
            eyebrow={isBar ? "Sistema independiente de Bar" : "Sistema independiente de Restaurante"}
            title={isBar ? "Pedidos y preparación de bebidas" : "Pedidos y preparación de platos"}
            description={isBar ? "Recibe, prepara, marca listo y entrega bebidas conectadas al cliente." : "Recibe, acepta, prepara, marca listo y entrega pedidos conectados al cliente."}
            actions={<Button as={Link} to="/inventario" variant="secondary" icon={PackageCheck}>Inventario y cierre</Button>}
          />
          <ModuleNav items={isBar ? [
            { label: "Pedidos", href: "/bartender/pendientes" },
            { label: "Insumos", href: "/bartender/insumos" },
            { label: "Historial", href: "/bartender/historial" }
          ] : [
            { label: "Pedidos", href: "/restaurante/pedidos" },
            { label: "Produccion", href: "/restaurante/produccion" },
            { label: "Historial", href: "/restaurante/historial" }
          ]} />
        </>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-3">
        <Metric icon={Clock} label="Pedidos activos" value={active.length} />
        <Metric icon={Icon} label={isBar ? "Bebidas preparando" : "Platos preparando"} value={list.filter((order) => ["EN_COCINA", "PREPARANDO"].includes(order.status)).length} />
        <Metric icon={CheckCircle2} label="Listos para entregar" value={list.filter((order) => order.status === "LISTO").length} />
      </section>

      <section className="flex flex-col gap-3 rounded-card border border-park-border bg-white p-4 shadow-card lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-balance text-lg font-black text-park-dark">Flujo en una sola pantalla</h2>
          <p className="text-pretty text-sm text-park-muted">
            {isBar ? "Recibir → Preparar → Listo y descontado → Entregar" : "Recibir → Aceptar → Preparar → Listo y descontado → Entregar"}
          </p>
        </div>
        <Tabs tabs={[
          { value: "ACTIVOS", label: "Activos" },
          { value: "LISTOS", label: "Listos" },
          { value: "ENTREGADOS", label: "Entregados" },
          { value: "TODOS", label: "Todos" }
        ]} value={view} onChange={setView} />
      </section>

      {failure ? <Alert tone="danger" title="No se pudo actualizar el pedido">{failure}</Alert> : null}
      {!filtered.length ? <EmptyState icon={Icon} title="Sin pedidos en esta vista" description="Los pedidos nuevos aparecerán aquí automáticamente." /> : (
        <section className="grid gap-4 xl:grid-cols-2">
          {filtered.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              area={area}
              canEdit={canEdit}
              busy={busyId === order.id}
              onAdvance={(target) => changeStatus(order, target)}
              onCancel={() => setCancelOrder(order)}
              onSelect={() => setSelected(order)}
            />
          ))}
        </section>
      )}

      {selected ? <OrderDetail area={area} canEdit={canEdit} order={selected} onClose={() => setSelected(null)} onStatus={changeStatus} /> : null}
      {cancelOrder ? <CancelOrderModal order={cancelOrder} onClose={() => setCancelOrder(null)} onConfirm={async () => { await changeStatus(cancelOrder, "CANCELADO"); setCancelOrder(null); }} /> : null}
    </div>
  );
}

function OrderCard({ order, area, canEdit, busy, onAdvance, onCancel, onSelect }) {
  const target = nextStatus(area, order.status);
  const destination = destinationFor(order);
  return (
    <article className={`rounded-card border bg-white p-5 shadow-card ${order.status === "LISTO" ? "border-park-green" : "border-park-border"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-black text-park-dark">{order.code}</h2><StatusBadge value={order.status} /></div>
          <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-park-green"><MapPin size={15} /> {destination.label}</p>
          <p className="mt-1 text-xs font-semibold text-park-muted">{clientLabel(order)} · {formatDateTime(order.createdAt)}</p>
        </div>
        <span className="rounded-full bg-park-bg px-3 py-1.5 text-xs font-bold text-park-muted">{order.estimatedMinutes || 15} min</span>
      </div>

      <div className="mt-4 space-y-3">
        {(order.items || []).map((item) => <RecipeTicket key={item.id || `${item.productId}-${item.name}`} item={item} />)}
      </div>
      {order.notes ? <div className="mt-4 rounded-card border border-amber-200 bg-amber-50 p-3 text-sm"><strong className="text-amber-900">Indicación:</strong> <span className="whitespace-pre-line text-amber-800">{order.notes}</span></div> : null}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-park-border pt-4">
        <div><p className="text-xs text-park-muted">Destino de entrega</p><strong className="text-sm text-park-dark">{destination.detail}</strong></div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" icon={Eye} onClick={onSelect}>Ver detalle</Button>
          {canEdit && !["ENTREGADO", "CANCELADO"].includes(order.status) ? <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button> : null}
          {canEdit && target ? <Button type="button" loading={busy} icon={target === "ENTREGADO" ? MapPin : target === "LISTO" ? Scale : area === "BARTENDER" ? Wine : ChefHat} variant={target === "ENTREGADO" ? "gold" : "primary"} onClick={() => onAdvance(target)}>{actionLabel(area, order.status, destination.label)}</Button> : null}
        </div>
      </div>
    </article>
  );
}

function RecipeTicket({ item }) {
  const total = Number(item.price || 0) * Number(item.quantity || 0);
  return (
    <section className="overflow-hidden rounded-card border border-park-border">
      <div className="flex items-center justify-between gap-3 bg-park-bg px-4 py-3">
        <div>
          <strong className="text-park-dark">{item.quantity} x {item.name}</strong>
          <p className="text-xs text-park-muted">{item.category || "Pedido de carta"}</p>
        </div>
        <strong className="text-sm text-park-green">S/ {total.toFixed(2)}</strong>
      </div>
    </section>
  );
}

function OrderDetail({ area, canEdit, order, onClose, onStatus }) {
  const next = nextStatus(area, order.status);
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
          <DetailRow label="Cliente" value={clientLabel(order)} />
          <DetailRow label="Habitacion" value={destinationFor(order).label} />
          <DetailRow label="Producto" value={itemsLabel(order)} />
          <DetailRow label="Total" value={`S/ ${Number(order.total).toFixed(2)}`} />
          <DetailRow label="Destino" value={order.destinationLabel || destinationFromNotes(order.notes)} />
          <DetailRow label="Notas" value={order.notes} />
          <DetailRow label="Recibido" value={formatDateTime(order.createdAt)} />
          <DetailRow label="Actualizado" value={formatDateTime(order.updatedAt)} />
        </section>
        <OrderRecipePlan plan={order.recipePlan} />
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
            <Button type="button" icon={next === "ENTREGADO" ? MapPin : next === "LISTO" ? Scale : area === "BARTENDER" ? Wine : ChefHat} onClick={() => onStatus(order, next)}>
              {actionLabel(area, order.status, destinationFor(order).label)}
            </Button>
          </div>
        ) : null}
      </aside>
    </div>
  );
}

function CancelOrderModal({ order, onClose, onConfirm }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <form className="w-full max-w-lg rounded-card bg-white p-5 shadow-drawer" onSubmit={async (event) => { event.preventDefault(); setBusy(true); setError(""); try { await onConfirm(); } catch (failure) { setError(failure.message); } finally { setBusy(false); } }}>
        <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase text-park-gold">Cancelar pedido</p><h2 className="text-xl font-black text-park-dark">{order.code}</h2></div><button type="button" className="grid size-9 place-items-center rounded-button border border-park-border" aria-label="Cerrar" onClick={onClose}><X size={17} /></button></div>
        <p className="mt-4 text-sm text-park-muted">El pedido saldrá de la operación activa. Si ya estaba en preparación, revisa inventario antes de cerrar turno.</p>
        {error ? <p className="mt-3 text-sm font-bold text-park-danger">{error}</p> : null}
        <div className="mt-5 flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Volver</Button><Button variant="danger" loading={busy}>Confirmar cancelación</Button></div>
      </form>
    </div>
  );
}

function nextStatus(area, status) {
  const flow = area === "BARTENDER"
    ? { PENDIENTE: "PREPARANDO", PREPARANDO: "LISTO", LISTO: "ENTREGADO" }
    : { PENDIENTE: "EN_COCINA", EN_COCINA: "PREPARANDO", PREPARANDO: "LISTO", LISTO: "ENTREGADO" };
  return flow[status] || null;
}

function actionLabel(area, status, destination) {
  if (status === "PENDIENTE") return area === "BARTENDER" ? "Aceptar y preparar" : "Aceptar pedido";
  if (status === "EN_COCINA") return "Iniciar preparacion";
  if (status === "PREPARANDO") return "Terminado - descontar receta";
  if (status === "LISTO") return "Entregar en " + destination;
  return "Avanzar pedido";
}

function destinationFor(order) {
  const room = order.room?.number || order.stay?.room?.number || order.roomId;
  if (room) return { label: "Habitacion " + room, detail: "Llevar a la habitacion " + room };
  const destination = order.destinationLabel || destinationFromNotes(order.notes);
  if (destination) return { label: destination, detail: destination };
  return { label: "Servicio sin habitacion", detail: "Confirmar punto de entrega con el cliente" };
}

function toastMessage(order, target) {
  if (target === "EN_COCINA") return `${order.code} aceptado por cocina.`;
  if (target === "PREPARANDO") return `${order.code} aceptado y en preparacion.`;
  if (target === "LISTO") return `${order.code} listo para entregar.`;
  if (target === "ENTREGADO") return `${order.code} entregado.`;
  if (target === "CANCELADO") return `${order.code} cancelado.`;
  return `${order.code} actualizado.`;
}

function viewFromStatus(status) {
  return ({ PENDIENTE: "RECIBIDOS", EN_COCINA: "PREPARANDO", PREPARANDO: "PREPARANDO", LISTO: "LISTOS", ENTREGADO: "ENTREGADOS" })[status];
}

function DetailRow({ label, value }) {
  if (!value) return null;
  return <div className="mb-3 grid grid-cols-[110px_1fr] gap-3 text-sm last:mb-0"><span className="font-semibold text-park-muted">{label}</span><strong className="text-park-black">{value}</strong></div>;
}

function clientLabel(order) {
  const client = order.client || order.stay?.client;
  return [client?.firstName, client?.lastName].filter(Boolean).join(" ").trim() || "Cliente no registrado";
}

function destinationFromNotes(notes) {
  return String(notes || "").split("\n").find((line) => line.startsWith("Destino:"))?.slice(8).trim() || "";
}

function historyFor(order) {
  const steps = ["Pedido recibido"];
  if (["EN_COCINA", "PREPARANDO", "LISTO", "ENTREGADO"].includes(order.status)) steps.push("Pedido aceptado");
  if (["PREPARANDO", "LISTO", "ENTREGADO"].includes(order.status)) steps.push("En preparacion");
  if (["LISTO", "ENTREGADO"].includes(order.status)) steps.push("Pedido listo");
  if (order.status === "ENTREGADO") steps.push("Pedido entregado");
  return steps;
}

function itemsLabel(order) {
  return order.items?.map((item) => `${item.quantity} x ${item.name}`).join(", ") || "Sin productos";
}

function formatDateTime(value) {
  if (!value) return "No registrado";
  return new Date(value).toLocaleString("es-PE");
}

function Metric({ icon: Icon, label, value }) {
  return <article className="rounded-card border border-park-border bg-white p-4 shadow-card"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-button bg-park-green-soft text-park-green"><Icon size={19} /></span><div><strong className="tabular-nums text-2xl text-park-dark">{value}</strong><p className="text-sm text-park-muted">{label}</p></div></div></article>;
}
