import { Link } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BedDouble, CalendarCheck, ClipboardCheck, DollarSign, LogIn, LogOut, RefreshCw, Users, AlertTriangle, Clock } from "lucide-react";
import { EmptyState } from "../../components/EmptyState";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { StatusBadge } from "../../components/StatusBadge";
import { Button } from "../../components/ui";
import { AdminMetricStrip, AdminTable, AdminTableHead, AdminTableRow, AdminTableHeaderCell, AdminTableCell } from "../../components/ui";
import { useFetch } from "../../hooks/useFetch";

const salesColors = ["#1E6FD6", "#112244", "#7EC6FF", "#64748b", "#cbd5e1"];

export function Dashboard() {
  const { data, loading, error, reload } = useFetch("/dashboard");
  if (loading) return <LoadingSpinner />;
  if (error) return <p className="rounded-md bg-park-danger-soft p-4 font-semibold text-park-danger">{error.message}</p>;

  const dashboardData = data;
  const metrics = dashboardData.metrics || {};
  const income = dashboardData.charts?.income || [];
  const salesByArea = dashboardData.charts?.salesByArea || [];
  const cleaning = dashboardData.modules?.cleaning || [];
  const orders = dashboardData.modules?.orders || [];
  const occupiedRooms = Number(metrics.occupiedRooms || 0);
  const availableRooms = Number(metrics.availableRooms || 0);
  const knownRooms = occupiedRooms + availableRooms;
  const occupancy = knownRooms ? Math.round((occupiedRooms / knownRooms) * 100) : 0;
  const lastUpdate = new Date().toLocaleString("es-PE");
  const alertItems = buildAlerts(dashboardData);

  const topMetrics = [
    { label: "Ocupación", value: `${occupancy}%`, subtext: `${occupiedRooms} ocupadas` },
    { label: "Ingresos", value: money(metrics.incomeToday) },
    { label: "Entradas Hoy", value: metrics.reservationsToday || 0 },
    { label: "Salidas Hoy", value: metrics.checkOutsToday || 0 },
  ];

  return (
    <div className="space-y-6 pb-10">
      {/* HEADER COMPACTO */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-park-dark">Dashboard</h1>
          <p className="text-sm text-park-muted">Resumen general de operaciones del hotel.</p>
        </div>
        <div className="flex items-center gap-4 text-sm text-park-muted">
          <span>Actualizado: {lastUpdate}</span>
          <Button icon={RefreshCw} variant="secondary" onClick={reload}>Actualizar</Button>
        </div>
      </div>

      <AdminMetricStrip metrics={topMetrics} />

      {/* SECCIÓN PRINCIPAL: GRÁFICOS Y ATENCIÓN */}
      <div className="grid gap-6 xl:grid-cols-[1fr_350px]">
        {/* GRÁFICOS */}
        <div className="grid gap-6 md:grid-cols-2">
          <Panel title="Ingresos de hoy">
            <div className="h-56 mt-4">
              {income.length ? (
                <ResponsiveContainer>
                  <AreaChart data={income}>
                    <defs>
                      <linearGradient id="incomeGradient" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="5%" stopColor="#1E6FD6" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#1E6FD6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#E5E7EB" vertical={false} />
                    <XAxis dataKey="time" tickLine={false} style={{ fontSize: '11px' }} />
                    <YAxis tickFormatter={(value) => `S/ ${value}`} tickLine={false} style={{ fontSize: '11px' }} />
                    <Tooltip formatter={(value) => money(value)} />
                    <Area dataKey="amount" fill="url(#incomeGradient)" stroke="#1E6FD6" strokeWidth={3} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState title="Sin ingresos" description="Los pagos del día aparecerán aquí." />
              )}
            </div>
          </Panel>

          <Panel title="Ventas por área">
            {salesByArea.length ? (
              <div className="mt-4 flex h-56 flex-col">
                <ResponsiveContainer width="100%" height="60%">
                  <PieChart>
                    <Pie data={salesByArea} dataKey="total" nameKey="area" innerRadius={40} outerRadius={60}>
                      {salesByArea.map((_, index) => <Cell fill={salesColors[index % salesColors.length]} key={index} />)}
                    </Pie>
                    <Tooltip formatter={(value) => money(value)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  {salesByArea.map((item, index) => (
                    <div className="flex items-center gap-2" key={item.area}>
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: salesColors[index % salesColors.length] }} />
                      <span className="truncate font-medium text-park-dark">{item.area}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-4 h-56">
                <EmptyState title="Sin ventas" description="Se mostrarán aquí." />
              </div>
            )}
          </Panel>
        </div>

        {/* ATENCIÓN REQUERIDA */}
        <Panel title="Atención requerida" titleClassName="text-park-danger flex items-center gap-2"><AlertTriangle size={18}/>
          {alertItems.length ? (
            <div className="mt-4 divide-y divide-park-border">
              {alertItems.map((item) => (
                <div key={item.key} className="py-3 flex justify-between items-center gap-4">
                  <div>
                    <p className="text-sm font-semibold text-park-dark">{item.area}</p>
                    <p className="text-xs text-park-muted">{item.problem}</p>
                  </div>
                  <Link to={item.href} className="text-xs font-semibold text-park-accent hover:underline">Ir</Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4">
              <EmptyState title="Todo al día" description="No hay atenciones críticas." />
            </div>
          )}
        </Panel>
      </div>

      {/* SECCIÓN SECUNDARIA: TABLAS */}
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Pedidos Operativos">
          {orders.length ? (
            <div className="mt-4">
              <AdminTable>
                <AdminTableHead>
                  <AdminTableHeaderCell>Pedido</AdminTableHeaderCell>
                  <AdminTableHeaderCell>Área</AdminTableHeaderCell>
                  <AdminTableHeaderCell>Estado</AdminTableHeaderCell>
                </AdminTableHead>
                <tbody>
                  {orders.map((order) => (
                    <AdminTableRow key={order.id}>
                      <AdminTableCell className="font-semibold text-park-dark">{order.code}</AdminTableCell>
                      <AdminTableCell>{order.area}</AdminTableCell>
                      <AdminTableCell><StatusBadge value={order.status} /></AdminTableCell>
                    </AdminTableRow>
                  ))}
                </tbody>
              </AdminTable>
            </div>
          ) : (
            <div className="mt-4">
              <EmptyState title="Sin pedidos" description="No hay pedidos activos." />
            </div>
          )}
        </Panel>

        <Panel title="Próximos Eventos">
          {dashboardData.upcomingEvents?.length ? (
            <div className="mt-4">
              <AdminTable>
                <AdminTableHead>
                  <AdminTableHeaderCell>Hora</AdminTableHeaderCell>
                  <AdminTableHeaderCell>Cliente</AdminTableHeaderCell>
                  <AdminTableHeaderCell>Estado</AdminTableHeaderCell>
                </AdminTableHead>
                <tbody>
                  {dashboardData.upcomingEvents.map((event) => (
                    <AdminTableRow key={event.id}>
                      <AdminTableCell className="font-semibold text-park-dark">{time(event.startsAt)}</AdminTableCell>
                      <AdminTableCell>{clientName(event.client)}</AdminTableCell>
                      <AdminTableCell><StatusBadge value={event.status} /></AdminTableCell>
                    </AdminTableRow>
                  ))}
                </tbody>
              </AdminTable>
            </div>
          ) : (
            <div className="mt-4">
              <EmptyState title="Sin eventos" description="No hay próximos eventos programados." />
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function buildAlerts(data) {
  const lowStock = (data.lowStock || []).map((product) => ({
    key: `stock-${product.id}`,
    area: product.area || "Inventario",
    problem: `${product.name} (Stock: ${Number(product.stock)})`,
    priority: Number(product.stock) <= 0 ? "CRITICA" : "ALTA",
    href: "/inventario"
  }));
  const cleaning = (data.modules?.cleaning || []).map((task) => ({
    key: `cleaning-${task.id}`,
    area: `Hab. ${task.room?.number || "-"}`,
    problem: `Limpieza ${String(task.status).replaceAll("_", " ").toLowerCase()}`,
    priority: task.priority || "MEDIA",
    href: "/limpieza/pendientes"
  }));
  const orders = (data.modules?.orders || []).map((order) => ({
    key: `order-${order.id}`,
    area: order.area,
    problem: `${order.code} ${String(order.status).replaceAll("_", " ").toLowerCase()}`,
    priority: order.status === "PENDIENTE" ? "MEDIA" : "BAJA",
    href: order.area === "BARTENDER" ? "/bartender/pendientes" : "/restaurante/pedidos"
  }));
  const incidents = data.metrics?.incidentsOpen ? [{
    key: "incidents-open",
    area: "Incidencias",
    problem: `${data.metrics.incidentsOpen} abiertos`,
    priority: data.metrics.incidentsHighPriority ? "CRITICA" : "ALTA",
    href: "/reportes"
  }] : [];
  return [...incidents, ...lowStock, ...cleaning, ...orders].slice(0, 5);
}

function Panel({ title, children, action, titleClassName = "text-park-dark" }) {
  return (
    <article className="rounded-lg border border-park-border bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className={`text-base font-semibold ${titleClassName}`}>{title}</h2>
        {action}
      </div>
      {children}
    </article>
  );
}

function money(value) {
  return `S/ ${Number(value || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function time(value) {
  return new Date(value).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
}

function clientName(client) {
  return client ? `${client.firstName || ""} ${client.lastName || ""}`.trim() : "-";
}
