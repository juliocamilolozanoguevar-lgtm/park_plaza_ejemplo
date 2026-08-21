import { useMemo, useState } from "react";
import { Calendar, ChefHat, Eye, ShoppingBag, TrendingUp } from "lucide-react";
import { EmptyState } from "../../components/EmptyState";
import { StatusBadge } from "../../components/StatusBadge";
import { Button } from "../../components/ui";

/* ─── Helpers ───────────────────────────────────────────────── */
function isToday(value) {
  if (!value) return false;
  const d = new Date(value);
  const today = new Date();
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
}

function startOfWeek() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1));
  return d;
}

function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfYear() {
  return new Date(new Date().getFullYear(), 0, 1);
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("es-PE");
}

function formatDateTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-PE");
}

function itemsLabel(order) {
  return order.items?.map((item) => item.name).join(", ") || "Sin productos";
}

const DAY_LABELS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const PERIOD_OPTIONS = [
  { value: "HOY", label: "Hoy" },
  { value: "SEMANA", label: "Semana" },
  { value: "MES", label: "Mes" },
  { value: "ANIO", label: "Año" },
  { value: "PERSONALIZADO", label: "Personalizado" }
];

/* ─── Componente principal ──────────────────────────────────── */
export function AdminConsumptionHistory({ orders = [] }) {
  const [period, setPeriod] = useState("HOY");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [appliedPeriod, setAppliedPeriod] = useState("HOY");
  const [appliedFrom, setAppliedFrom] = useState("");
  const [appliedTo, setAppliedTo] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);

  function handleConsult() {
    setAppliedPeriod(period);
    setAppliedFrom(dateFrom);
    setAppliedTo(dateTo);
  }

  const delivered = useMemo(() => orders.filter((o) => o.status === "ENTREGADO"), [orders]);

  const filteredOrders = useMemo(() => {
    let from, to;
    if (appliedPeriod === "HOY") {
      return delivered.filter((o) => isToday(o.updatedAt || o.createdAt));
    }
    if (appliedPeriod === "SEMANA") {
      from = startOfWeek();
      to = new Date();
    } else if (appliedPeriod === "MES") {
      from = startOfMonth();
      to = new Date();
    } else if (appliedPeriod === "ANIO") {
      from = startOfYear();
      to = new Date();
    } else if (appliedPeriod === "PERSONALIZADO") {
      from = appliedFrom ? new Date(appliedFrom) : null;
      to = appliedTo ? new Date(appliedTo + "T23:59:59") : null;
    }
    return delivered.filter((o) => {
      const d = new Date(o.updatedAt || o.createdAt);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }, [delivered, appliedPeriod, appliedFrom, appliedTo]);

  /* Platos más consumidos (por nombre de ítem) */
  const topDishes = useMemo(() => {
    const counts = {};
    filteredOrders.forEach((order) => {
      (order.items || []).forEach((item) => {
        const name = item.name || "Sin nombre";
        counts[name] = (counts[name] || 0) + Number(item.quantity || 1);
      });
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [filteredOrders]);

  /* Días de mayor consumo */
  const dayDistribution = useMemo(() => {
    const counts = Array(7).fill(0);
    filteredOrders.forEach((order) => {
      const d = new Date(order.updatedAt || order.createdAt);
      counts[d.getDay()] += 1;
    });
    return counts;
  }, [filteredOrders]);

  const maxDay = Math.max(...dayDistribution, 1);

  /* Resumen */
  const totalDishes = useMemo(
    () => filteredOrders.reduce((sum, o) => sum + (o.items?.reduce((s, i) => s + Number(i.quantity || 1), 0) || 0), 0),
    [filteredOrders]
  );
  const topDish = topDishes[0]?.[0] || null;
  const peakDayIdx = dayDistribution.indexOf(maxDay);
  const peakDay = peakDayIdx >= 0 && maxDay > 0 ? DAY_LABELS[peakDayIdx] : "—";

  return (
    <div className="space-y-5">
      {/* ── Filtros de período ──────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Botones de período */}
        <div className="flex flex-wrap gap-1.5">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPeriod(opt.value)}
              className={`rounded-button px-3 py-1.5 text-xs font-black transition ${
                period === opt.value
                  ? "bg-park-green text-white shadow-sm"
                  : "border border-park-border text-park-muted hover:border-park-green hover:text-park-green"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Rango personalizado */}
        {period === "PERSONALIZADO" ? (
          <>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-black uppercase text-park-muted">Desde</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-9 rounded-input border border-park-border px-3 text-sm outline-none focus:border-park-green"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-black uppercase text-park-muted">Hasta</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-9 rounded-input border border-park-border px-3 text-sm outline-none focus:border-park-green"
              />
            </label>
          </>
        ) : null}

        <Button icon={Calendar} onClick={handleConsult} type="button">
          Consultar
        </Button>
      </div>

      {/* ── Franja de métricas compacta ─────────────────────────── */}
      <div className="rounded-card border border-park-border bg-white shadow-card">
        <div className="grid grid-cols-2 divide-x divide-park-border sm:grid-cols-4">
          <MetricStrip
            icon={ShoppingBag}
            label="Pedidos entregados"
            value={filteredOrders.length}
            tone="blue"
          />
          <MetricStrip
            icon={ChefHat}
            label="Platos preparados"
            value={totalDishes}
            tone="green"
          />
          <MetricStrip
            icon={TrendingUp}
            label="Más consumido"
            value={topDish || "—"}
            subtitle={topDish ? `${topDishes[0][1]} unid.` : null}
            tone="gold"
            compact
          />
          <MetricStrip
            icon={Calendar}
            label="Día pico"
            value={peakDay}
            tone="green"
          />
        </div>
      </div>

      {/* ── Analíticas: dos columnas ────────────────────────────── */}
      <div className="grid gap-5 xl:grid-cols-2">
        {/* Platos más consumidos */}
        <section className="rounded-card border border-park-border bg-white p-4 shadow-card">
          <h2 className="mb-3 text-xs font-black uppercase tracking-wide text-park-muted">
            Platos más consumidos
          </h2>
          {topDishes.length ? (
            <ol className="space-y-2">
              {topDishes.map(([name, qty], index) => (
                <li key={name} className="flex items-center gap-3">
                  <span
                    className={`grid h-5 w-5 flex-shrink-0 place-items-center rounded-full text-[10px] font-black ${
                      index === 0
                        ? "bg-park-gold text-white"
                        : index === 1
                        ? "bg-park-muted/20 text-park-muted"
                        : "bg-park-bg text-park-muted"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span className="flex-1 truncate text-sm font-semibold text-park-black">{name}</span>
                  <span className="text-xs text-park-muted">{qty} unid.</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="py-4 text-center text-xs text-park-muted">Sin pedidos en este período.</p>
          )}
        </section>

        {/* Distribución por día */}
        <section className="rounded-card border border-park-border bg-white p-4 shadow-card">
          <h2 className="mb-3 text-xs font-black uppercase tracking-wide text-park-muted">
            Distribución por día
          </h2>
          {filteredOrders.length ? (
            <div className="space-y-2">
              {DAY_LABELS.map((day, idx) => {
                const count = dayDistribution[idx];
                const pct = maxDay > 0 ? Math.round((count / maxDay) * 100) : 0;
                return (
                  <div key={day} className="flex items-center gap-3">
                    <span className="w-20 flex-shrink-0 text-xs font-semibold text-park-muted">{day}</span>
                    <div className="flex-1 overflow-hidden rounded-full bg-park-bg h-2">
                      <div
                        className="h-2 rounded-full bg-park-green transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-6 text-right text-xs font-black text-park-black">{count}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-4 text-center text-xs text-park-muted">Sin pedidos en este período.</p>
          )}
        </section>
      </div>

      {/* ── Consumo de ingredientes ─────────────────────────────── */}
      {/* 
      <section className="rounded-card border border-park-border bg-white px-5 py-4 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-xs font-black uppercase tracking-wide text-park-muted">
              Consumo de ingredientes
            </h2>
            <p className="mt-0.5 text-sm text-park-muted">
              El cálculo automático estará disponible cuando se complete la integración correspondiente.
            </p>
          </div>
          <span className="rounded-button border border-dashed border-park-border px-3 py-1 text-xs font-black text-park-muted">
            Próximamente
          </span>
        </div>
      </section>
      */}

      {/* ── Detalle de pedidos ──────────────────────────────────── */}
      <section className="rounded-card border border-park-border bg-white shadow-card">
        <div className="border-b border-park-border px-5 py-3 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xs font-black uppercase tracking-wide text-park-muted">
              Detalle de pedidos
            </h2>
            <p className="mt-0.5 text-sm font-semibold text-park-black">
              {filteredOrders.length} pedido{filteredOrders.length !== 1 ? "s" : ""} entregado
              {filteredOrders.length !== 1 ? "s" : ""} en el período seleccionado.
            </p>
          </div>
        </div>
        {!filteredOrders.length ? (
          <p className="px-5 py-6 text-center text-xs text-park-muted">
            No hay pedidos entregados en este período.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[820px] w-full text-left text-sm">
              <thead className="text-xs uppercase text-park-muted bg-park-bg">
                <tr>
                  <th className="py-3 px-5">Fecha</th>
                  <th className="px-3">Pedido</th>
                  <th className="px-3">Origen</th>
                  <th className="px-3">Productos</th>
                  <th className="px-3">Total</th>
                  <th className="px-3">Estado</th>
                  <th className="px-3 text-right">Ver</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-park-border">
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="transition hover:bg-park-bg">
                    <td className="py-3 px-5 text-park-muted">{formatDate(order.updatedAt || order.createdAt)}</td>
                    <td className="px-3 font-black text-park-black">{order.code}</td>
                    <td className="px-3">{order.stay?.room?.number || order.roomId || "Piscina"}</td>
                    <td className="px-3 max-w-[220px] truncate text-park-muted">{itemsLabel(order)}</td>
                    <td className="px-3 font-semibold">S/ {Number(order.total).toFixed(2)}</td>
                    <td className="px-3">
                      <StatusBadge value={order.status} />
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Button
                        icon={Eye}
                        size="sm"
                        type="button"
                        variant="secondary"
                        onClick={() => setSelectedOrder(order)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Drawer detalle de pedido */}
      {selectedOrder ? (
        <OrderDetailDrawer order={selectedOrder} onClose={() => setSelectedOrder(null)} />
      ) : null}
    </div>
  );
}

/* ─── Franja métrica compacta ───────────────────────────────── */
function MetricStrip({ icon: Icon, label, value, tone = "green", subtitle = null, compact = false }) {
  const tones = {
    gold: "bg-park-gold-soft text-park-gold",
    blue: "bg-blue-50 text-blue-700",
    green: "bg-park-green-soft text-park-green"
  };
  return (
    <div className="flex items-center gap-3 px-4 py-3 sm:py-4">
      <span className={`grid h-8 w-8 flex-shrink-0 place-items-center rounded-button ${tones[tone]}`}>
        <Icon size={15} />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-wide text-park-muted leading-none">{label}</p>
        <strong
          className={`block truncate font-display font-semibold text-park-dark leading-tight mt-0.5 ${
            compact ? "text-base" : "text-lg"
          }`}
        >
          {value}
        </strong>
        {subtitle ? <span className="block text-[10px] text-park-muted leading-none mt-0.5">{subtitle}</span> : null}
      </div>
    </div>
  );
}

/* ─── Drawer detalle de pedido ──────────────────────────────── */
function OrderDetailDrawer({ order, onClose }) {
  return (
    <div className="fixed inset-0 z-40 bg-slate-950/30 p-4">
      <aside className="ml-auto h-full max-w-md overflow-auto rounded-card bg-white p-5 shadow-drawer">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase text-park-gold">Detalle del pedido</p>
            <h3 className="font-sans text-xl font-black text-park-black">{order.code}</h3>
          </div>
          <button
            className="grid h-9 w-9 place-items-center rounded-button border border-park-border text-park-muted hover:text-park-black"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </div>
        <div className="mt-3">
          <StatusBadge value={order.status} />
        </div>
        <section className="mt-5 rounded-card border border-park-border bg-park-bg p-4">
          <h4 className="mb-3 text-xs font-black uppercase text-park-green">Información general</h4>
          <DetailRow label="Habitación" value={order.stay?.room?.number || order.roomId || "Piscina"} />
          <DetailRow label="Productos" value={itemsLabel(order)} />
          <DetailRow label="Total" value={`S/ ${Number(order.total).toFixed(2)}`} />
          <DetailRow label="Pedido" value={formatDateTime(order.createdAt)} />
          <DetailRow label="Entregado" value={formatDateTime(order.updatedAt)} />
          <DetailRow label="Observaciones" value={order.notes} />
        </section>

        {order.items?.length ? (
          <section className="mt-4 rounded-card border border-park-border bg-white p-4">
            <h4 className="mb-3 text-xs font-black uppercase text-park-green">Productos del pedido</h4>
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-park-muted">
                <tr>
                  <th className="pb-2 text-left">Producto</th>
                  <th className="pb-2 text-right">Cant.</th>
                  <th className="pb-2 text-right">Precio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-park-border">
                {order.items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-2 font-semibold text-park-black">{item.name}</td>
                    <td className="py-2 text-right text-park-muted">{item.quantity}</td>
                    <td className="py-2 text-right">S/ {Number(item.price || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}
      </aside>
    </div>
  );
}

function DetailRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="mb-3 grid grid-cols-[110px_1fr] gap-3 text-sm last:mb-0">
      <span className="font-semibold text-park-muted">{label}</span>
      <strong className="text-park-black">{value}</strong>
    </div>
  );
}

function X({ size }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
