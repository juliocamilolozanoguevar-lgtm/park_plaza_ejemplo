import { ClipboardList, PackageCheck, TrendingUp, TriangleAlert } from "lucide-react";
import { EmptyState } from "../../components/EmptyState";
import { StatusBadge } from "../../components/StatusBadge";
import { Tabs } from "../../components/ui";
import { useFetch } from "../../hooks/useFetch";
import { useState } from "react";

export function AdminFoodReports({ area, orders = [], reports = [], allowProduction = false }) {
  const [tab, setTab] = useState("CONSUMOS");
  const { data: movements } = useFetch(`/inventory/movements?area=${area}`, { initialData: [] });
  const { data: requests } = useFetch(`/supply-requests?area=${area}`, { initialData: [] });
  const { data: productions } = useFetch(`/production?area=${area}`, { initialData: [], enabled: allowProduction });
  const delivered = orders.filter((order) => order.status === "ENTREGADO");
  const losses = movements.filter((item) => isLossMovement(item));
  const wasteProductions = productions.filter((item) => Number(item.wasteQty) > 0);
  const tabs = [
    { value: "KARDEX", label: "Kardex / Movimientos" },
    { value: "CONSUMOS", label: "Consumos" },
    ...(allowProduction ? [{ value: "PRODUCCION", label: "Producciones" }, { value: "MERMAS", label: "Mermas" }, { value: "RENDIMIENTOS", label: "Rendimientos" }] : [{ value: "PERDIDAS", label: "Perdidas" }]),
    { value: "REPORTES", label: "Reportes" }
  ];

  return (
    <div className="space-y-5">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric icon={PackageCheck} label="Entregados" value={delivered.length} />
        <Metric icon={TrendingUp} label="Movimientos" value={movements.length} />
        <Metric icon={ClipboardList} label="Solicitudes" value={requests.length} />
        <Metric icon={TriangleAlert} label="Incidencias" value={reports.length} tone="gold" />
      </section>
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === "CONSUMOS" ? <OrdersHistory orders={delivered} /> : null}
      {tab === "KARDEX" ? <MovementsTable movements={movements} /> : null}
      {tab === "PERDIDAS" ? <MovementsTable emptyTitle="Sin perdidas" movements={losses} /> : null}
      {tab === "MERMAS" ? <WasteTable productions={wasteProductions} /> : null}
      {tab === "RENDIMIENTOS" ? <YieldTable productions={productions} /> : null}
      {tab === "REPORTES" ? <ReportsTable reports={reports} /> : null}
      {tab === "PRODUCCION" ? <ProductionsTable productions={productions} /> : null}
    </div>
  );
}

function OrdersHistory({ orders }) {
  if (!orders.length) return <EmptyState title="Sin consumos" description="No hay pedidos entregados para esta area." />;
  return <Table columns={["Pedido", "Destino", "Productos", "Total", "Fecha"]} rows={orders} render={(order) => <tr key={order.id}><td className="py-3 font-black text-park-black">{order.code}</td><td>{order.stay?.room?.number || order.roomId || "-"}</td><td>{order.items?.map((item) => `${item.quantity} x ${item.name}`).join(", ")}</td><td>S/ {Number(order.total).toFixed(2)}</td><td>{date(order.updatedAt || order.createdAt)}</td></tr>} />;
}

function MovementsTable({ movements, emptyTitle = "Sin movimientos" }) {
  if (!movements.length) return <EmptyState title={emptyTitle} description="No hay Kardex para esta area." />;
  return <Table columns={["Fecha", "Producto", "Tipo", "Cantidad", "Antes", "Despues", "Motivo"]} rows={movements} render={(item) => <tr key={item.id}><td className="py-3">{date(item.createdAt)}</td><td className="font-black text-park-black">{item.product?.name}</td><td><StatusBadge value={item.type} /></td><td>{Number(item.quantity)} {item.product?.unit}</td><td>{Number(item.beforeQty)}</td><td>{Number(item.afterQty)}</td><td>{item.reason || "-"}</td></tr>} />;
}

function RequestsTable({ requests }) {
  if (!requests.length) return <EmptyState title="Sin solicitudes" description="No hay solicitudes registradas." />;
  return <Table columns={["Solicitud", "Items", "Estado", "Fecha"]} rows={requests} render={(item) => <tr key={item.id}><td className="py-3 font-black text-park-black">#{item.id}</td><td>{item.items?.map((row) => `${Number(row.quantity)} ${row.unit} ${row.product?.name}`).join(", ")}</td><td><StatusBadge value={item.status} /></td><td>{date(item.createdAt)}</td></tr>} />;
}

function ReportsTable({ reports }) {
  if (!reports.length) return <EmptyState title="Sin incidencias" description="No hay reportes operativos." />;
  return <Table columns={["Codigo", "Tipo", "Descripcion", "Prioridad", "Estado", "Fecha"]} rows={reports} render={(item) => <tr key={item.id}><td className="py-3 font-black text-park-black">{item.code}</td><td>{item.type?.replaceAll("_", " ")}</td><td>{item.description}</td><td><StatusBadge value={item.priority} /></td><td><StatusBadge value={item.status} /></td><td>{date(item.createdAt)}</td></tr>} />;
}

function ProductionsTable({ productions }) {
  if (!productions.length) return <EmptyState title="Sin producciones" description="No hay producciones registradas." />;
  return <Table columns={["Codigo", "Transformacion", "Usado", "Obtenido", "Merma", "Rendimiento"]} rows={productions} render={(item) => <tr key={item.id}><td className="py-3 font-black text-park-black">{item.code}</td><td>{item.inputProduct?.name} {"->"} {item.outputProduct?.name}</td><td>{Number(item.inputQty)} {item.inputProduct?.unit}</td><td>{Number(item.outputQty)} {item.outputProduct?.unit}</td><td>{Number(item.wasteQty)} {item.inputProduct?.unit}</td><td>{Number(item.yieldPercent).toFixed(1)}%</td></tr>} />;
}

function WasteTable({ productions }) {
  if (!productions.length) return <EmptyState title="Sin mermas" description="No hay mermas registradas para esta area." />;
  return <Table columns={["Produccion", "Producto", "Tipo", "Cantidad", "Costo", "Fecha"]} rows={productions} render={(item) => <tr key={item.id}><td className="py-3 font-black text-park-black">{item.code}</td><td>{item.inputProduct?.name}</td><td><StatusBadge value="MERMA_PRODUCCION" /></td><td>{Number(item.wasteQty)} {item.inputProduct?.unit}</td><td>S/ {(Number(item.wasteQty) * Number(item.inputProduct?.cost || 0)).toFixed(2)}</td><td>{date(item.createdAt)}</td></tr>} />;
}

function YieldTable({ productions }) {
  if (!productions.length) return <EmptyState title="Sin rendimientos" description="No hay producciones para calcular rendimiento." />;
  return <Table columns={["Produccion", "Transformacion", "Usado", "Obtenido", "Merma", "Rendimiento"]} rows={productions} render={(item) => <tr key={item.id}><td className="py-3 font-black text-park-black">{item.code}</td><td>{item.inputProduct?.name} {"->"} {item.outputProduct?.name}</td><td>{Number(item.inputQty)} {item.inputProduct?.unit}</td><td>{Number(item.outputQty)} {item.outputProduct?.unit}</td><td>{Number(item.wasteQty)} {item.inputProduct?.unit}</td><td>{Number(item.yieldPercent).toFixed(1)}%</td></tr>} />;
}

function Table({ columns, rows, render }) {
  return <section className="rounded-card border border-park-border bg-white p-5 shadow-card"><div className="overflow-x-auto"><table className="min-w-[860px] text-left text-sm"><thead className="text-xs uppercase text-park-muted"><tr>{columns.map((column) => <th className="py-3" key={column}>{column}</th>)}</tr></thead><tbody className="divide-y divide-park-border">{rows.map(render)}</tbody></table></div></section>;
}

function Metric({ icon: Icon, label, value, tone = "green" }) {
  const styles = tone === "gold" ? "bg-park-gold-soft text-park-gold" : "bg-park-green-soft text-park-green";
  return <article className="rounded-card border border-park-border bg-white p-5 shadow-card"><span className={`grid h-11 w-11 place-items-center rounded-button ${styles}`}><Icon size={20} /></span><p className="mt-4 text-sm font-semibold text-park-muted">{label}</p><strong className="font-display text-2xl text-park-dark">{value}</strong></article>;
}

function date(value) {
  return value ? new Date(value).toLocaleString("es-PE") : "-";
}

function isLossMovement(item) {
  const text = [item.reason, item.reference, item.type].filter(Boolean).join(" ").toLowerCase();
  return text.includes("perdida") || text.includes("pérdida") || text.includes("merma") || text.includes("deterioro");
}
