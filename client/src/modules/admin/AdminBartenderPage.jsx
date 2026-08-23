import { AlertTriangle, CheckCircle2, Clock, Eye, PackageCheck, Wine, X } from "lucide-react";
import { useMemo, useState } from "react";
import { EmptyState } from "../../components/EmptyState";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { OrderRecipePlan } from "../../components/OrderRecipePlan";
import { StatusBadge } from "../../components/StatusBadge";
import { Button, PageHeader, Tabs, AdminTable, AdminTableHead, AdminTableRow, AdminTableHeaderCell, AdminTableCell, AdminDrawer, AdminMetricStrip } from "../../components/ui";
import { useFetch } from "../../hooks/useFetch";
import { ModuleNav } from "../../components/ui/ModuleNav";
import { AdminFoodManagement } from "./AdminFoodManagement";
import { AdminFoodReports } from "./AdminFoodReports";

export function AdminBartenderPage({ view = "resumen" }) {
  const { data: ordersData, loading } = useFetch("/bartender", { initialData: [] });
  const { data: reportsData } = useFetch("/reports?area=BARTENDER", { initialData: { reports: [], summary: {} } });
  const { data: auditData } = useFetch("/auditoria", { initialData: [] });
  const { data: inventorySummary } = useFetch("/inventory/summary?area=BARTENDER", { initialData: { lowStock: 0, noStock: 0 } });
  const { data: requests } = useFetch("/supply-requests?area=BARTENDER", { initialData: [] });
  const [status, setStatus] = useState("TODOS");
  const [selected, setSelected] = useState(null);
  const orders = Array.isArray(ordersData) ? ordersData : [];
  const reports = reportsData?.reports || [];
  const audits = Array.isArray(auditData) ? auditData.filter((item) => item.module === "PEDIDOS" || item.module === "BARTENDER") : [];
  const filteredOrders = useMemo(() => filterOrders(view, orders, status), [orders, status, view]);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6 pb-10">
      <PageHeader eyebrow="Administrador / Bartender" title={pageTitle(view)} description="Operación del bar." />
      <ModuleNav items={[
        { label: "Resumen", href: "/admin/bartender/resumen" },
        { label: "Gestión", href: "/admin/bartender/gestion" },
        { label: "Historial y reportes", href: "/admin/bartender/reportes" }
      ]} />
      {view === "resumen" ? <BartenderSummary audits={audits} inventorySummary={inventorySummary} orders={orders} reports={reports} requests={requests} onSelect={setSelected} /> : null}
      {view === "gestion" ? <AdminFoodManagement area="BARTENDER" /> : null}
      {view === "reportes" ? <AdminFoodReports area="BARTENDER" orders={orders} reports={reports} /> : null}
      {["pedidos", "historial"].includes(view) ? (
        <>
          {view === "pedidos" ? (
            <div className="mb-4 overflow-x-auto">
              <Tabs tabs={["TODOS", "PENDIENTE", "PREPARANDO", "LISTO", "ENTREGADO"].map((item) => ({ value: item, label: item === "TODOS" ? "Todos" : item.replaceAll("_", " ") }))} value={status} onChange={setStatus} />
            </div>
          ) : null}
          <OrdersTable orders={filteredOrders} onSelect={setSelected} />
        </>
      ) : null}
      {view === "incidencias" ? <IncidentsTable reports={reports} /> : null}
      
      <OrderDetail order={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function BartenderSummary({ orders, reports, audits, inventorySummary, requests, onSelect }) {
  const pending = orders.filter((item) => item.status === "PENDIENTE").length;
  const preparing = orders.filter((item) => ["PREPARANDO", "LISTO"].includes(item.status)).length;
  const deliveredToday = orders.filter((item) => item.status === "ENTREGADO" && isToday(item.updatedAt)).length;
  const active = orders.filter((item) => item.status !== "ENTREGADO" && item.status !== "CANCELADO").slice(0, 6);
  const criticalStock = (inventorySummary.lowStock || 0) + (inventorySummary.noStock || 0);

  const metrics = [
    { label: "Pedidos activos", value: pending + preparing },
    { label: "Entregados hoy", value: deliveredToday },
    { label: "Solicitudes", value: (requests || []).filter((item) => item.status === "PENDIENTE").length },
    { label: "Stock crítico", value: criticalStock },
  ];

  return (
    <>
      <AdminMetricStrip metrics={metrics} />
      
      <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="Pedidos activos">
          <OrdersTable orders={active} onSelect={onSelect} />
        </Panel>
        <Panel title="Bebidas y alertas">
          {reports.length ? (
            <div className="space-y-2">
              {reports.slice(0, 4).map((report) => (
                <div className="rounded-md border border-park-border bg-white p-3 shadow-sm" key={report.id}>
                  <div className="flex justify-between gap-3"><p className="font-semibold text-park-dark text-sm">{report.code}</p><StatusBadge value={report.priority} /></div>
                  <p className="mt-1 text-xs text-park-muted">{report.description}</p>
                </div>
              ))}
            </div>
          ) : <EmptyState title="Sin incidencias" description="No hay problemas reportados por bartender." />}
        </Panel>
      </section>
    </>
  );
}

function OrdersTable({ orders, onSelect }) {
  if (!orders.length) return <EmptyState title="Sin pedidos" description="No hay pedidos para esta vista." />;
  return (
    <AdminTable>
      <AdminTableHead>
        <AdminTableHeaderCell>Pedido</AdminTableHeaderCell>
        <AdminTableHeaderCell>Habitación</AdminTableHeaderCell>
        <AdminTableHeaderCell>Producto</AdminTableHeaderCell>
        <AdminTableHeaderCell>Total</AdminTableHeaderCell>
        <AdminTableHeaderCell>Estado</AdminTableHeaderCell>
        <AdminTableHeaderCell>Fecha</AdminTableHeaderCell>
        <AdminTableHeaderCell>Acciones</AdminTableHeaderCell>
      </AdminTableHead>
      <tbody>
        {orders.map((order) => (
          <AdminTableRow key={order.id} onClick={() => onSelect(order)}>
            <AdminTableCell className="font-semibold text-park-dark">{order.code}</AdminTableCell>
            <AdminTableCell>{order.stay?.room?.number || order.roomId || "Piscina"}</AdminTableCell>
            <AdminTableCell className="max-w-[200px] truncate" title={itemsLabel(order)}>{itemsLabel(order)}</AdminTableCell>
            <AdminTableCell>S/ {Number(order.total).toFixed(2)}</AdminTableCell>
            <AdminTableCell><StatusBadge value={order.status} /></AdminTableCell>
            <AdminTableCell>{formatDateTime(order.updatedAt || order.createdAt)}</AdminTableCell>
            <AdminTableCell>
              <Button className="h-8 w-8 px-0" icon={Eye} onClick={(event) => { event.stopPropagation(); onSelect(order); }} size="sm" type="button" variant="secondary" />
            </AdminTableCell>
          </AdminTableRow>
        ))}
      </tbody>
    </AdminTable>
  );
}

function IncidentsTable({ reports }) {
  if (!reports.length) return <EmptyState title="Sin incidencias" description="No hay reportes operativos del bartender." />;
  return (
    <AdminTable>
      <AdminTableHead>
        <AdminTableHeaderCell>Código</AdminTableHeaderCell>
        <AdminTableHeaderCell>Descripción</AdminTableHeaderCell>
        <AdminTableHeaderCell>Prioridad</AdminTableHeaderCell>
        <AdminTableHeaderCell>Reportado por</AdminTableHeaderCell>
        <AdminTableHeaderCell>Fecha</AdminTableHeaderCell>
        <AdminTableHeaderCell>Estado</AdminTableHeaderCell>
      </AdminTableHead>
      <tbody>
        {reports.map((report) => (
          <AdminTableRow key={report.id}>
            <AdminTableCell className="font-semibold text-park-dark">{report.code}</AdminTableCell>
            <AdminTableCell className="max-w-[250px] truncate" title={report.description}>{report.description}</AdminTableCell>
            <AdminTableCell><StatusBadge value={report.priority} /></AdminTableCell>
            <AdminTableCell>{report.reportedBy ? `${report.reportedBy.firstName} ${report.reportedBy.lastName}` : "No registrado"}</AdminTableCell>
            <AdminTableCell>{formatDateTime(report.createdAt)}</AdminTableCell>
            <AdminTableCell><StatusBadge value={report.status} /></AdminTableCell>
          </AdminTableRow>
        ))}
      </tbody>
    </AdminTable>
  );
}

function OrderDetail({ order, onClose }) {
  return (
    <AdminDrawer open={!!order} onClose={onClose} title={order ? `Detalle de Pedido ${order.code}` : "Pedido"} width="w-full max-w-md">
      {order && (
        <div className="space-y-5">
          <div><StatusBadge value={order.status} /></div>
          
          <Panel title="Información general" className="mt-0">
            <DetailRow label="Habitación" value={order.stay?.room?.number || order.roomId || "Piscina"} />
            <DetailRow label="Producto" value={itemsLabel(order)} />
            <DetailRow label="Total" value={`S/ ${Number(order.total).toFixed(2)}`} />
            <DetailRow label="Recibido" value={formatDateTime(order.createdAt)} />
            <DetailRow label="Actualizado" value={formatDateTime(order.updatedAt)} />
            <DetailRow label="Bartender" value={order.createdBy?.firstName || "No registrado"} />
          </Panel>
          
          <OrderRecipePlan plan={order.recipePlan} />
          
          <Panel title="Historial del pedido">
            {historyFor(order).map((item) => (
              <div className="flex gap-3 pb-3 last:pb-0" key={item}>
                <span className="mt-1.5 h-2 w-2 rounded-full bg-park-accent" />
                <p className="text-sm font-medium text-park-dark">{item}</p>
              </div>
            ))}
          </Panel>
        </div>
      )}
    </AdminDrawer>
  );
}

function Panel({ title, children, className = "" }) {
  return (
    <section className={`rounded-lg border border-park-border bg-white p-5 shadow-sm ${className}`}>
      <h2 className="mb-4 text-base font-semibold text-park-dark">{title}</h2>
      {children}
    </section>
  );
}

function DetailRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="mb-3 grid grid-cols-[110px_1fr] gap-3 text-sm last:mb-0">
      <span className="font-medium text-park-muted">{label}</span>
      <strong className="font-medium text-park-dark">{value}</strong>
    </div>
  );
}

function filterOrders(view, orders, status) {
  if (view === "historial") return orders.filter((order) => order.status === "ENTREGADO");
  if (status !== "TODOS") return orders.filter((order) => order.status === status);
  return orders;
}

function historyFor(order) {
  const steps = ["Pedido recibido"];
  if (["PREPARANDO", "LISTO", "ENTREGADO"].includes(order.status)) steps.push("Preparación iniciada");
  if (["LISTO", "ENTREGADO"].includes(order.status)) steps.push("Marcado como listo");
  if (order.status === "ENTREGADO") steps.push("Pedido entregado");
  return steps;
}

function itemsLabel(order) {
  return order.items?.map((item) => `${item.quantity} x ${item.name}`).join(", ") || "Sin productos";
}

function pageTitle(view) {
  const titles = { resumen: "Bartender - Resumen", pedidos: "Bartender - Pedidos", gestion: "Bartender - Gestión", reportes: "Bartender - Historial y reportes", historial: "Bartender - Historial", incidencias: "Bartender - Incidencias" };
  return titles[view] || titles.resumen;
}

function formatDateTime(value) {
  if (!value) return "No registrado";
  return new Date(value).toLocaleString("es-PE");
}

function isToday(value) {
  if (!value) return false;
  const date = new Date(value);
  const today = new Date();
  return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
}
