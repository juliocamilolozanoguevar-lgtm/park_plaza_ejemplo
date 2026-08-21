import { AlertTriangle, ChefHat, Clock, Eye, Flame, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { EmptyState } from "../../components/EmptyState";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { OrderRecipePlan } from "../../components/OrderRecipePlan";
import { StatusBadge } from "../../components/StatusBadge";
import { Button, PageHeader, Tabs } from "../../components/ui";
import { useFetch } from "../../hooks/useFetch";
import { ModuleNav } from "../../components/ui/ModuleNav";
import { AdminFoodManagement } from "./AdminFoodManagement";
import { AdminFoodReports } from "./AdminFoodReports";
import { AdminFoodRecipes } from "./AdminFoodRecipes";
import { AdminConsumptionHistory } from "./AdminConsumptionHistory";
import { ProductionPage } from "../employees/ProductionPage";
import { SuppliesPage } from "../employees/SuppliesPage";

export function AdminRestaurantPage({ view = "resumen" }) {
  const normalizedView = ["cocina", "preparando", "listos", "entregados"].includes(view) ? "pedidos" : view;
  const navigate = useNavigate();
  const { data: ordersData, loading } = useFetch("/restaurante", { initialData: [] });
  const { data: reportsData } = useFetch("/reports?area=RESTAURANTE", { initialData: { reports: [], summary: {} } });
  const { data: auditData } = useFetch("/auditoria", { initialData: [] });
  const { data: inventorySummary } = useFetch("/inventory/summary?area=RESTAURANTE", { initialData: { lowStock: 0, noStock: 0 } });
  const { data: requests } = useFetch("/supply-requests?area=RESTAURANTE", { initialData: [] });
  const { data: productionSummary } = useFetch("/production/summary?area=RESTAURANTE", { initialData: { total: 0, totalWaste: 0, yieldPercent: 0 } });
  const [status, setStatus] = useState(statusByView(view) || "TODOS");
  const [search, setSearch] = useState("");
  const [incidentSearch, setIncidentSearch] = useState("");
  const [priority, setPriority] = useState("TODOS");
  const [incidentStatus, setIncidentStatus] = useState("TODOS");
  const [selected, setSelected] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const orders = Array.isArray(ordersData) ? ordersData : [];
  const reports = reportsData?.reports || [];
  const audits = Array.isArray(auditData) ? auditData.filter((item) => item.module === "PEDIDOS" || item.module === "RESTAURANTE") : [];
  const filteredOrders = useMemo(() => filterOrders(orders, status, search), [orders, status, search]);
  const filteredReports = useMemo(() => filterReports(reports, incidentSearch, priority, incidentStatus), [reports, incidentSearch, priority, incidentStatus]);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Administrador" title="Restaurante" description="Operacion de cocina y servicio." />
      <ModuleNav items={[
        { label: "Operación", href: "/admin/restaurante/resumen" },
        { label: "Carta y recetas", href: "/admin/restaurante/platos-y-recetas" },
        { label: "Control", href: "/admin/restaurante/historial-consumo" }
      ]} />
      {normalizedView === "resumen" ? <RestaurantOperationsView audits={audits} inventorySummary={inventorySummary} orders={orders} filteredOrders={filteredOrders} productionSummary={productionSummary} reports={reports} requests={requests} search={search} setSearch={setSearch} status={status} setStatus={setStatus} onSelect={setSelected} onReportSelect={setSelectedReport} /> : null}
      {normalizedView === "platos-y-recetas" ? <AdminFoodRecipes /> : null}
      {normalizedView === "historial-consumo" ? (
        <RestaurantControlView 
          orders={orders} reports={reports} filteredReports={filteredReports} 
          incidentSearch={incidentSearch} setIncidentSearch={setIncidentSearch} 
          priority={priority} setPriority={setPriority} 
          incidentStatus={incidentStatus} setIncidentStatus={setIncidentStatus} 
          onSelectReport={setSelectedReport} 
        />
      ) : null}
      {/* Vistas heredadas — preservadas para acceso por URL directa */}
      {normalizedView === "pedidos" ? (
        <OrdersView orders={filteredOrders} search={search} setSearch={setSearch} status={status} setStatus={setStatus} onSelect={setSelected} />
      ) : null}
      {normalizedView === "gestion" ? <AdminFoodManagement area="RESTAURANTE" allowProduction /> : null}
      {normalizedView === "reportes" ? <AdminFoodReports area="RESTAURANTE" orders={orders} reports={reports} allowProduction /> : null}
      {normalizedView === "incidencias" ? <IncidentsView reports={filteredReports} search={incidentSearch} setSearch={setIncidentSearch} priority={priority} setPriority={setPriority} status={incidentStatus} setStatus={setIncidentStatus} onSelect={setSelectedReport} /> : null}
      {selected ? <OrderDetail order={selected} onClose={() => setSelected(null)} /> : null}
      {selectedReport ? <ReportDetail report={selectedReport} onClose={() => setSelectedReport(null)} /> : null}
    </div>
  );
}

function RestaurantOperationsView({
  orders, filteredOrders, reports, audits, inventorySummary, productionSummary, requests,
  search, setSearch, status, setStatus, onSelect, onReportSelect
}) {
  const [activeTab, setActiveTab] = useState("Resumen");
  
  return (
    <div className="space-y-5">
      <div className="mb-2 overflow-x-auto border-b border-park-border">
        <nav className="-mb-px flex min-w-max gap-6">
          {["Resumen", "Pedidos activos", "Produccion", "Insumos y Mermas"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`whitespace-nowrap border-b-2 py-3 px-1 text-sm font-semibold transition-colors ${
                activeTab === tab
                  ? "border-park-green text-park-green"
                  : "border-transparent text-park-muted hover:border-park-border hover:text-park-black"
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === "Resumen" ? (
        <RestaurantSummary 
          orders={orders} reports={reports} audits={audits}
          inventorySummary={inventorySummary} productionSummary={productionSummary} 
          requests={requests} onSelect={onSelect} onReportSelect={onReportSelect} 
          onStatus={(s) => { setStatus(s); setActiveTab("Pedidos activos"); }} 
        />
      ) : null}

      {activeTab === "Pedidos activos" ? (
        <OrdersView orders={filteredOrders} search={search} setSearch={setSearch} status={status} setStatus={setStatus} onSelect={onSelect} />
      ) : null}

      {activeTab === "Produccion" ? (
        <ProductionPage area="RESTAURANTE" admin />
      ) : null}

      {activeTab === "Insumos y Mermas" ? (
        <SuppliesPage area="RESTAURANTE" />
      ) : null}
    </div>
  );
}

function RestaurantControlView({
  orders, reports, filteredReports, 
  incidentSearch, setIncidentSearch, priority, setPriority, 
  incidentStatus, setIncidentStatus, onSelectReport
}) {
  const [activeTab, setActiveTab] = useState("Consumo");

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl font-black text-park-black uppercase">Control</h2>
        <p className="text-sm text-park-muted">Consulta y seguimiento de la operación del restaurante.</p>
      </div>

      <div className="mb-2 overflow-x-auto border-b border-park-border">
        <nav className="-mb-px flex min-w-max gap-6">
          {["Consumo", "Mermas", "Incidencias"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`whitespace-nowrap border-b-2 py-3 px-1 text-sm font-semibold transition-colors ${
                activeTab === tab
                  ? "border-park-green text-park-green"
                  : "border-transparent text-park-muted hover:border-park-border hover:text-park-black"
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === "Consumo" ? (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-black text-park-black">Historial de consumo</h3>
            <p className="text-sm text-park-muted">Consulta el comportamiento del restaurante por período.</p>
          </div>
          <AdminConsumptionHistory orders={orders} />
        </div>
      ) : null}

      {activeTab === "Mermas" ? (
        <div className="py-6">
          <p className="text-sm text-park-muted">Todavía no hay registros de merma disponibles.</p>
        </div>
      ) : null}

      {activeTab === "Incidencias" ? (
        <IncidentsView 
          reports={filteredReports} 
          search={incidentSearch} setSearch={setIncidentSearch} 
          priority={priority} setPriority={setPriority} 
          status={incidentStatus} setStatus={setIncidentStatus} 
          onSelect={onSelectReport} 
        />
      ) : null}
    </div>
  );
}

function RestaurantSummary({ orders, reports, audits, inventorySummary, productionSummary, requests, onSelect, onReportSelect, onStatus }) {
  const activeOrders = orders.filter((item) => !["ENTREGADO", "CANCELADO"].includes(item.status)).length;
  const criticalStock = (inventorySummary.lowStock || 0) + (inventorySummary.noStock || 0);
  const recent = orders.slice(0, 8);
  const recentReports = reports.slice(0, 5);

  return (
    <>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Clock} label="Pedidos activos" tone="gold" value={activeOrders} onClick={() => onStatus("TODOS")} />
        <Metric icon={ChefHat} label="Produccion" tone="blue" value={productionSummary.total || 0} />
        <Metric icon={Flame} label="Merma del dia" tone="orange" value={Number(productionSummary.totalWaste || 0).toFixed(2)} />
        <Metric icon={AlertTriangle} label="Stock critico" tone="red" value={criticalStock} />
      </section>
      <section className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="Actividad reciente">
          <OrdersTable compact orders={recent} onSelect={onSelect} />
        </Panel>
        <Panel title="Alertas">
          {recentReports.length ? recentReports.map((report) => (
            <button className="mb-3 w-full rounded-card border border-park-border bg-park-bg p-3 text-left hover:border-park-green" key={report.id} onClick={() => onReportSelect(report)} type="button">
              <div className="flex justify-between gap-3"><p className="font-black text-park-black">{report.code}</p><StatusBadge value={report.priority} /></div>
              <p className="mt-1 text-sm text-park-muted">{report.description}</p>
            </button>
          )) : <EmptyState title="Sin incidencias" description="No hay problemas reportados desde restaurante." />}
        </Panel>
      </section>
    </>
  );
}

function OrdersView({ orders, search, setSearch, status, setStatus, onSelect }) {
  return (
    <section className="rounded-card border border-park-border bg-white p-4 shadow-card">
      <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
        <label>
          <span className="text-xs font-black uppercase text-park-muted">Buscar</span>
          <input className="mt-2 h-11 w-full rounded-input border border-park-border px-3 text-sm outline-none focus:border-park-green" placeholder="Codigo, habitacion, producto o responsable..." value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        <div className="max-w-full overflow-x-auto">
          <Tabs tabs={orderStatusTabs()} value={status} onChange={setStatus} />
        </div>
      </div>
      <OrdersTable orders={orders} onSelect={onSelect} />
    </section>
  );
}

function IncidentsView({ reports, search, setSearch, priority, setPriority, status, setStatus, onSelect }) {
  return (
    <section className="rounded-card border border-park-border bg-white p-4 shadow-card">
      <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_180px_180px] lg:items-end">
        <label>
          <span className="text-xs font-black uppercase text-park-muted">Buscar</span>
          <input className="mt-2 h-11 w-full rounded-input border border-park-border px-3 text-sm outline-none focus:border-park-green" placeholder="Codigo, tipo, descripcion o responsable..." value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        <Select label="Prioridad" value={priority} onChange={setPriority} options={["TODOS", "BAJA", "MEDIA", "ALTA", "CRITICA"]} />
        <Select label="Estado" value={status} onChange={setStatus} options={["TODOS", "ABIERTO", "EN_REVISION", "RESUELTO"]} />
      </div>
      <IncidentsTable reports={reports} onSelect={onSelect} />
    </section>
  );
}

function OrdersTable({ orders, onSelect, compact = false }) {
  if (!orders.length) return <EmptyState title="Sin pedidos" description="No hay pedidos para esta vista." />;
  return (
    <section className={compact ? "" : ""}>
      <div className="overflow-x-auto">
        <table className="min-w-[760px] text-left text-sm">
          <thead className="text-xs uppercase text-park-muted"><tr><th className="py-3">Pedido</th><th>Habitacion</th><th>Producto</th><th>Total</th><th>Estado</th><th>Hora</th><th>Ver</th></tr></thead>
          <tbody className="divide-y divide-park-border">
            {orders.map((order) => (
              <tr className="cursor-pointer transition hover:bg-park-bg" key={order.id} onClick={() => onSelect(order)}>
                <td className="py-3 font-black text-park-black">{order.code}</td>
                <td>{order.stay?.room?.number || order.roomId || "Piscina"}</td>
                <td>{itemsLabel(order)}</td>
                <td>S/ {Number(order.total).toFixed(2)}</td>
                <td><StatusBadge value={order.status} /></td>
                <td>{formatDateTime(order.updatedAt || order.createdAt)}</td>
                <td><Button className="h-8 w-8 px-0" icon={Eye} onClick={(event) => { event.stopPropagation(); onSelect(order); }} size="sm" type="button" variant="secondary" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function IncidentsTable({ reports, onSelect }) {
  if (!reports.length) return <EmptyState title="Sin incidencias" description="No hay reportes operativos del restaurante." />;
  return (
    <section>
      <div className="overflow-x-auto">
        <table className="min-w-[780px] text-left text-sm">
          <thead className="text-xs uppercase text-park-muted"><tr><th className="py-3">Codigo</th><th>Tipo</th><th>Descripcion</th><th>Prioridad</th><th>Responsable</th><th>Fecha</th><th>Estado</th><th>Ver</th></tr></thead>
          <tbody className="divide-y divide-park-border">
            {reports.map((report) => (
              <tr key={report.id}>
                <td className="py-3 font-black text-park-black">{report.code}</td>
                <td>{report.type?.replaceAll("_", " ")}</td>
                <td>{report.description}</td>
                <td><StatusBadge value={report.priority} /></td>
                <td>{report.reportedBy ? `${report.reportedBy.firstName} ${report.reportedBy.lastName}` : "Sin asignar"}</td>
                <td>{formatDateTime(report.createdAt)}</td>
                <td><StatusBadge value={report.status} /></td>
                <td><Button className="h-8 w-8 px-0" icon={Eye} onClick={() => onSelect(report)} size="sm" type="button" variant="secondary" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function OrderDetail({ order, onClose }) {
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
        <div className="mt-3"><StatusBadge value={order.status} /></div>
        <Panel title="Informacion general">
          <DetailRow label="Habitacion" value={order.stay?.room?.number || order.roomId || "Piscina"} />
          <DetailRow label="Producto" value={itemsLabel(order)} />
          <DetailRow label="Cantidad" value={quantityLabel(order)} />
          <DetailRow label="Total" value={`S/ ${Number(order.total).toFixed(2)}`} />
          <DetailRow label="Responsable" value={responsibleLabel(order)} />
          <DetailRow label="Pedido" value={formatDateTime(order.createdAt)} />
          <DetailRow label="Actualizado" value={formatDateTime(order.updatedAt)} />
          <DetailRow label="Observaciones" value={order.notes} />
        </Panel>
        <OrderRecipePlan plan={order.recipePlan} />
        <Panel title="Tiempos del pedido">
          {historyFor(order).map((item) => (
            <div className="flex gap-3 pb-3 last:pb-0" key={item}>
              <span className="mt-1 h-2.5 w-2.5 rounded-full bg-park-green" />
              <p className="text-sm font-semibold text-park-black">{item}</p>
            </div>
          ))}
        </Panel>
      </aside>
    </div>
  );
}

function ReportDetail({ report, onClose }) {
  return (
    <div className="fixed inset-0 z-40 bg-slate-950/30 p-4">
      <aside className="ml-auto h-full max-w-md overflow-auto rounded-card bg-white p-5 shadow-drawer">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase text-park-gold">Detalle de incidencia</p>
            <h3 className="font-sans text-xl font-black text-park-black">{report.code}</h3>
          </div>
          <button className="grid h-9 w-9 place-items-center rounded-button border border-park-border text-park-muted hover:text-park-black" onClick={onClose} type="button"><X size={18} /></button>
        </div>
        <div className="mt-3 flex gap-2"><StatusBadge value={report.priority} /><StatusBadge value={report.status} /></div>
        <Panel title="Informacion general">
          <DetailRow label="Tipo" value={report.type?.replaceAll("_", " ")} />
          <DetailRow label="Descripcion" value={report.description} />
          <DetailRow label="Responsable" value={report.reportedBy ? `${report.reportedBy.firstName} ${report.reportedBy.lastName}` : "Sin asignar"} />
          <DetailRow label="Fecha" value={formatDateTime(report.createdAt)} />
          <DetailRow label="Producto" value={report.product?.name} />
          <DetailRow label="Habitacion" value={report.room?.number} />
        </Panel>
        {report.evidences?.length ? <Panel title="Evidencias">{report.evidences.map((evidence) => <DetailRow key={evidence.id} label="Archivo" value={evidence.url || evidence.path || evidence.fileName} />)}</Panel> : null}
      </aside>
    </div>
  );
}

function Metric({ icon: Icon, label, value, tone, onClick }) {
  const tones = {
    gold: "bg-park-gold-soft text-park-gold",
    orange: "bg-orange-50 text-orange-700",
    blue: "bg-blue-50 text-blue-700",
    purple: "bg-purple-50 text-purple-700",
    green: "bg-park-green-soft text-park-green",
    red: "bg-red-50 text-park-danger"
  };
  const Component = onClick ? "button" : "article";
  return <Component className="rounded-card border border-park-border bg-white p-5 text-left shadow-card transition hover:border-park-green" onClick={onClick} type={onClick ? "button" : undefined}><span className={`grid h-11 w-11 place-items-center rounded-button ${tones[tone]}`}><Icon size={20} /></span><p className="mt-4 text-sm font-semibold text-park-muted">{label}</p><strong className="font-display text-[28px] font-semibold text-park-dark">{value}</strong>{onClick ? <span className="mt-1 block text-xs font-black text-park-green">Ver pedidos</span> : null}</Component>;
}

function Panel({ title, children }) {
  return <section className="mt-5 rounded-card border border-park-border bg-white p-5 shadow-card"><h2 className="mb-4 font-sans text-lg font-black text-park-black">{title}</h2>{children}</section>;
}

function DetailRow({ label, value }) {
  if (!value) return null;
  return <div className="mb-3 grid grid-cols-[110px_1fr] gap-3 text-sm last:mb-0"><span className="font-semibold text-park-muted">{label}</span><strong className="text-park-black">{value}</strong></div>;
}

function filterOrders(orders, status, search) {
  const term = search.trim().toLowerCase();
  return orders.filter((order) => {
    const matchesStatus = status === "TODOS" || order.status === status;
    const haystack = [order.code, order.stay?.room?.number, order.roomId, itemsLabel(order), responsibleLabel(order)].filter(Boolean).join(" ").toLowerCase();
    return matchesStatus && (!term || haystack.includes(term));
  });
}

function filterReports(reports, search, priority, status) {
  const term = search.trim().toLowerCase();
  return reports.filter((report) => {
    const matchesPriority = priority === "TODOS" || report.priority === priority;
    const matchesStatus = status === "TODOS" || report.status === status;
    const responsible = report.reportedBy ? `${report.reportedBy.firstName} ${report.reportedBy.lastName}` : "";
    const haystack = [report.code, report.type, report.description, responsible].filter(Boolean).join(" ").toLowerCase();
    return matchesPriority && matchesStatus && (!term || haystack.includes(term));
  });
}

function statusByView(view) {
  return { cocina: "EN_COCINA", preparando: "PREPARANDO", listos: "LISTO", entregados: "ENTREGADO" }[view];
}

function orderStatusTabs() {
  return ["TODOS", "PENDIENTE", "EN_COCINA", "PREPARANDO", "LISTO", "ENTREGADO"].map((item) => ({ value: item, label: item === "TODOS" ? "Todos" : item.replaceAll("_", " ") }));
}

function Select({ label, value, onChange, options }) {
  return <label><span className="text-xs font-black uppercase text-park-muted">{label}</span><select className="mt-2 h-11 w-full rounded-input border border-park-border bg-white px-3 text-sm outline-none focus:border-park-green" value={value} onChange={(event) => onChange(event.target.value)}>{options.map((item) => <option key={item} value={item}>{item === "TODOS" ? "Todos" : item.replaceAll("_", " ")}</option>)}</select></label>;
}

function historyFor(order) {
  const steps = ["Pedido recibido"];
  if (["EN_COCINA", "PREPARANDO", "LISTO", "ENTREGADO"].includes(order.status)) steps.push("En cocina");
  if (["PREPARANDO", "LISTO", "ENTREGADO"].includes(order.status)) steps.push("Inicio preparacion");
  if (["LISTO", "ENTREGADO"].includes(order.status)) steps.push("Listo");
  if (order.status === "ENTREGADO") steps.push("Entregado");
  return steps;
}

function itemsLabel(order) {
  return order.items?.map((item) => item.name).join(", ") || "Sin productos";
}

function quantityLabel(order) {
  return order.items?.map((item) => item.quantity).reduce((sum, value) => sum + Number(value || 0), 0) || 0;
}

function responsibleLabel(order) {
  if (order.createdBy?.firstName || order.createdBy?.lastName) return [order.createdBy.firstName, order.createdBy.lastName].filter(Boolean).join(" ");
  if (typeof order.createdBy === "string") return order.createdBy;
  return "Sin asignar";
}

function countBy(items, key) {
  return items.reduce((acc, item) => ({ ...acc, [item[key]]: (acc[item[key]] || 0) + 1 }), {});
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
