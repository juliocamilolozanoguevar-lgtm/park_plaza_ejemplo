import { AlertTriangle, ChefHat, Clock, Eye, Flame, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { EmptyState } from "../../components/EmptyState";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { OrderRecipePlan } from "../../components/OrderRecipePlan";
import { StatusBadge } from "../../components/StatusBadge";
import { Button, PageHeader, Tabs, AdminTable, AdminTableHead, AdminTableRow, AdminTableHeaderCell, AdminTableCell, AdminDrawer, AdminMetricStrip } from "../../components/ui";
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
    <div className="space-y-6 pb-10">
      <PageHeader eyebrow="Administrador" title="Restaurante" description="Operación de cocina y servicio." />
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
      
      <OrderDetail order={selected} onClose={() => setSelected(null)} />
      <ReportDetail report={selectedReport} onClose={() => setSelectedReport(null)} />
    </div>
  );
}

function RestaurantOperationsView({
  orders, filteredOrders, reports, audits, inventorySummary, productionSummary, requests,
  search, setSearch, status, setStatus, onSelect, onReportSelect
}) {
  const [activeTab, setActiveTab] = useState("Resumen");
  
  return (
    <div className="space-y-6">
      <div className="mb-2 overflow-x-auto border-b border-park-border">
        <nav className="-mb-px flex min-w-max gap-6">
          {["Resumen", "Pedidos activos", "Produccion", "Insumos y Mermas"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`whitespace-nowrap border-b-2 py-3 px-1 text-sm font-semibold transition-colors ${
                activeTab === tab
                  ? "border-park-primary text-park-primary"
                  : "border-transparent text-park-muted hover:border-park-border hover:text-park-dark"
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
    <div className="space-y-6">
      <div className="mb-2 overflow-x-auto border-b border-park-border">
        <nav className="-mb-px flex min-w-max gap-6">
          {["Consumo", "Mermas", "Incidencias"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`whitespace-nowrap border-b-2 py-3 px-1 text-sm font-semibold transition-colors ${
                activeTab === tab
                  ? "border-park-primary text-park-primary"
                  : "border-transparent text-park-muted hover:border-park-border hover:text-park-dark"
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
            <h3 className="text-lg font-bold text-park-dark">Historial de consumo</h3>
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
  
  const metrics = [
    { label: "Pedidos activos", value: activeOrders },
    { label: "Producción", value: productionSummary.total || 0 },
    { label: "Merma del día", value: Number(productionSummary.totalWaste || 0).toFixed(2) },
    { label: "Stock crítico", value: criticalStock },
  ];

  return (
    <>
      <AdminMetricStrip metrics={metrics} />
      <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="Actividad reciente">
          <OrdersTable orders={recent} onSelect={onSelect} />
        </Panel>
        <Panel title="Alertas">
          {recentReports.length ? (
            <div className="space-y-2">
              {recentReports.map((report) => (
                <button className="w-full rounded-md border border-park-border bg-white p-3 text-left hover:border-park-primary transition-colors" key={report.id} onClick={() => onReportSelect(report)} type="button">
                  <div className="flex justify-between gap-3"><p className="font-semibold text-park-dark text-sm">{report.code}</p><StatusBadge value={report.priority} /></div>
                  <p className="mt-1 text-xs text-park-muted">{report.description}</p>
                </button>
              ))}
            </div>
          ) : <EmptyState title="Sin incidencias" description="No hay problemas reportados desde restaurante." />}
        </Panel>
      </section>
    </>
  );
}

function OrdersView({ orders, search, setSearch, status, setStatus, onSelect }) {
  return (
    <section className="rounded-lg border border-park-border bg-white p-5 shadow-sm">
      <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <label>
          <span className="text-xs font-bold uppercase text-park-muted">Buscar</span>
          <input className="mt-1.5 h-10 w-full rounded-md border border-park-border px-3 text-sm outline-none focus:border-park-primary focus:ring-1 focus:ring-park-primary" placeholder="Código, habitación, producto o responsable..." value={search} onChange={(event) => setSearch(event.target.value)} />
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
    <section className="rounded-lg border border-park-border bg-white p-5 shadow-sm">
      <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_180px_180px] lg:items-end">
        <label>
          <span className="text-xs font-bold uppercase text-park-muted">Buscar</span>
          <input className="mt-1.5 h-10 w-full rounded-md border border-park-border px-3 text-sm outline-none focus:border-park-primary focus:ring-1 focus:ring-park-primary" placeholder="Código, tipo, descripción o responsable..." value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        <Select label="Prioridad" value={priority} onChange={setPriority} options={["TODOS", "BAJA", "MEDIA", "ALTA", "CRITICA"]} />
        <Select label="Estado" value={status} onChange={setStatus} options={["TODOS", "ABIERTO", "EN_REVISION", "RESUELTO"]} />
      </div>
      <IncidentsTable reports={reports} onSelect={onSelect} />
    </section>
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
        <AdminTableHeaderCell>Hora</AdminTableHeaderCell>
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

function IncidentsTable({ reports, onSelect }) {
  if (!reports.length) return <EmptyState title="Sin incidencias" description="No hay reportes operativos del restaurante." />;
  return (
    <AdminTable>
      <AdminTableHead>
        <AdminTableHeaderCell>Código</AdminTableHeaderCell>
        <AdminTableHeaderCell>Tipo</AdminTableHeaderCell>
        <AdminTableHeaderCell>Descripción</AdminTableHeaderCell>
        <AdminTableHeaderCell>Prioridad</AdminTableHeaderCell>
        <AdminTableHeaderCell>Responsable</AdminTableHeaderCell>
        <AdminTableHeaderCell>Fecha</AdminTableHeaderCell>
        <AdminTableHeaderCell>Estado</AdminTableHeaderCell>
        <AdminTableHeaderCell>Acciones</AdminTableHeaderCell>
      </AdminTableHead>
      <tbody>
        {reports.map((report) => (
          <AdminTableRow key={report.id}>
            <AdminTableCell className="font-semibold text-park-dark">{report.code}</AdminTableCell>
            <AdminTableCell>{report.type?.replaceAll("_", " ")}</AdminTableCell>
            <AdminTableCell className="max-w-[200px] truncate" title={report.description}>{report.description}</AdminTableCell>
            <AdminTableCell><StatusBadge value={report.priority} /></AdminTableCell>
            <AdminTableCell>{report.reportedBy ? `${report.reportedBy.firstName} ${report.reportedBy.lastName}` : "Sin asignar"}</AdminTableCell>
            <AdminTableCell>{formatDateTime(report.createdAt)}</AdminTableCell>
            <AdminTableCell><StatusBadge value={report.status} /></AdminTableCell>
            <AdminTableCell>
              <Button className="h-8 w-8 px-0" icon={Eye} onClick={() => onSelect(report)} size="sm" type="button" variant="secondary" />
            </AdminTableCell>
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

function ReportDetail({ report, onClose }) {
  return (
    <AdminDrawer open={!!report} onClose={onClose} title={report ? `Incidencia ${report.code}` : "Incidencia"} width="w-full max-w-md">
      {report && (
        <div className="space-y-5">
          <div className="flex gap-2"><StatusBadge value={report.priority} /><StatusBadge value={report.status} /></div>
          
          <Panel title="Información general" className="mt-0">
            <DetailRow label="Tipo" value={report.type?.replaceAll("_", " ")} />
            <DetailRow label="Descripción" value={report.description} />
            <DetailRow label="Responsable" value={report.reportedBy ? `${report.reportedBy.firstName} ${report.reportedBy.lastName}` : "Sin asignar"} />
            <DetailRow label="Fecha" value={formatDateTime(report.createdAt)} />
            <DetailRow label="Producto" value={report.product?.name} />
            <DetailRow label="Habitación" value={report.room?.number} />
          </Panel>
          
          {report.evidences?.length ? (
            <Panel title="Evidencias">
              {report.evidences.map((evidence) => <DetailRow key={evidence.id} label="Archivo" value={evidence.url || evidence.path || evidence.fileName} />)}
            </Panel>
          ) : null}
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
  return (
    <label>
      <span className="text-xs font-bold uppercase text-park-muted">{label}</span>
      <select className="mt-1.5 h-10 w-full rounded-md border border-park-border bg-white px-3 text-sm outline-none focus:border-park-primary focus:ring-1 focus:ring-park-primary" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((item) => <option key={item} value={item}>{item === "TODOS" ? "Todos" : item.replaceAll("_", " ")}</option>)}
      </select>
    </label>
  );
}

function historyFor(order) {
  const steps = ["Pedido recibido"];
  if (["EN_COCINA", "PREPARANDO", "LISTO", "ENTREGADO"].includes(order.status)) steps.push("En cocina");
  if (["PREPARANDO", "LISTO", "ENTREGADO"].includes(order.status)) steps.push("Inicio preparación");
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

function formatDateTime(value) {
  if (!value) return "No registrado";
  return new Date(value).toLocaleString("es-PE");
}
