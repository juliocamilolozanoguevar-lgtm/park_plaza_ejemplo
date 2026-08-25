import { AlertTriangle, Camera, CheckCircle2, Clock, Eye, Wrench, X } from "lucide-react";
import { useMemo, useState } from "react";
import { EmptyState } from "../../components/EmptyState";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { StatusBadge } from "../../components/StatusBadge";
import { Button, PageHeader, AdminTable, AdminTableHead, AdminTableRow, AdminTableHeaderCell, AdminTableCell, AdminMetricStrip, AdminDrawer } from "../../components/ui";
import { useFetch } from "../../hooks/useFetch";
import { ModuleNav } from "../../components/ui/ModuleNav";
import { ImagePreview } from "../../components/ImagePreview";

export function AdminMaintenancePage({ view = "resumen" }) {
  const { data, loading } = useFetch("/reports", { initialData: { reports: [] } });
  const { data: auditData } = useFetch("/auditoria", { initialData: [] });
  const [selected, setSelected] = useState(null);
  const reports = useMemo(() => (data?.reports || []).filter((report) => report.requiresMaintenance), [data]);
  const audits = Array.isArray(auditData) ? auditData.filter((item) => item.module === "REPORTES") : [];
  const visible = useMemo(() => filterReports(view, reports), [reports, view]);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Administrador / Mantenimiento" title={pageTitle(view)} description="Supervision de incidencias tecnicas y trabajos derivados a mantenimiento." />
      <ModuleNav items={[
        { label: "Resumen", href: "/admin/mantenimiento/resumen" },
        { label: "Solicitudes", href: "/admin/mantenimiento/solicitudes" },
        { label: "En reparacion", href: "/admin/mantenimiento/reparacion" },
        { label: "Finalizados", href: "/admin/mantenimiento/finalizados" },
        { label: "Evidencias", href: "/admin/mantenimiento/evidencias" }
      ]} />
      {view === "resumen" ? <MaintenanceSummary audits={audits} reports={reports} onSelect={setSelected} /> : null}
      {["solicitudes", "reparacion", "finalizados"].includes(view) ? <ReportsTable reports={visible} onSelect={setSelected} /> : null}
      {view === "evidencias" ? <EvidenceGrid reports={visible} onSelect={setSelected} /> : null}
      {selected ? <MaintenanceDetail report={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

function MaintenanceSummary({ reports, audits, onSelect }) {
  const pending = reports.filter((item) => item.status === "ABIERTO");
  const repair = reports.filter((item) => item.status === "EN_REVISION");
  const finishedToday = reports.filter((item) => item.status === "RESUELTO" && isToday(item.resolvedAt));
  const high = reports.filter((item) => ["ALTA", "CRITICA"].includes(item.priority) && item.status !== "RESUELTO");
  const evidencePending = reports.filter((item) => !item.evidences?.length && item.status !== "RESUELTO");

  return (
    <>
      <AdminMetricStrip metrics={[
        { label: "Pendientes", value: pending.length },
        { label: "En reparacion", value: repair.length },
        { label: "Finalizados hoy", value: finishedToday.length },
        { label: "Alta / critica", value: high.length },
        { label: "Evidencias pendientes", value: evidencePending.length }
      ]} />
      <section className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="Trabajos activos">
          <ReportsTable compact reports={reports.filter((item) => item.status !== "RESUELTO").slice(0, 6)} onSelect={onSelect} />
        </Panel>
        <Panel title="Incidencias tecnicas recientes">
          {reports.length ? reports.slice(0, 4).map((report) => (
            <button className="mb-3 w-full rounded-card border border-park-border bg-park-bg p-3 text-left hover:border-park-green" key={report.id} onClick={() => onSelect(report)} type="button">
              <div className="flex justify-between gap-3"><p className="font-black text-park-black">{report.code}</p><StatusBadge value={report.priority} /></div>
              <p className="mt-1 text-sm text-park-muted">{report.description}</p>
            </button>
          )) : <EmptyState title="Sin incidencias" description="No hay reportes tecnicos derivados." />}
        </Panel>
      </section>
      <Panel title="Actividad reciente">
        {audits.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-park-muted"><tr><th className="py-2">Actividad</th><th>Usuario</th><th>Fecha</th></tr></thead>
              <tbody className="divide-y divide-park-border">
                {audits.slice(0, 6).map((item) => <tr key={item.id}><td className="py-3 font-semibold text-park-black">{item.detail || item.action}</td><td>{item.user ? `${item.user.firstName} ${item.user.lastName}` : "Sistema"}</td><td>{formatDateTime(item.createdAt)}</td></tr>)}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title="Sin actividad" description="La auditoria de reportes aparecera aqui." />}
      </Panel>
    </>
  );
}

function ReportsTable({ reports, onSelect, compact = false }) {
  if (!reports.length) return <EmptyState title="Sin trabajos" description="No hay reportes tecnicos para esta vista." />;
  return (
    <section className={compact ? "" : "rounded-card border border-park-border bg-white p-5 shadow-card"}>
      <AdminTable>
        <AdminTableHead>
          <AdminTableHeaderCell>Codigo</AdminTableHeaderCell>
          <AdminTableHeaderCell>Ubicacion</AdminTableHeaderCell>
          <AdminTableHeaderCell>Problema</AdminTableHeaderCell>
          <AdminTableHeaderCell>Prioridad</AdminTableHeaderCell>
          <AdminTableHeaderCell>Tecnico</AdminTableHeaderCell>
          <AdminTableHeaderCell>Estado</AdminTableHeaderCell>
          <AdminTableHeaderCell>Hora</AdminTableHeaderCell>
          <AdminTableHeaderCell>Ver</AdminTableHeaderCell>
        </AdminTableHead>
        <tbody>
          {reports.map((report) => (
            <AdminTableRow key={report.id} onClick={() => onSelect(report)}>
              <AdminTableCell className="font-black text-park-black">{report.code}</AdminTableCell>
              <AdminTableCell>{locationLabel(report)}</AdminTableCell>
              <AdminTableCell>{report.description}</AdminTableCell>
              <AdminTableCell><StatusBadge value={report.priority} /></AdminTableCell>
              <AdminTableCell>{report.resolvedBy ? `${report.resolvedBy.firstName} ${report.resolvedBy.lastName}` : "Sin asignar"}</AdminTableCell>
              <AdminTableCell><StatusBadge value={report.status} /></AdminTableCell>
              <AdminTableCell>{formatDateTime(report.createdAt)}</AdminTableCell>
              <AdminTableCell><Button className="h-8 w-8 px-0" icon={Eye} onClick={(event) => { event.stopPropagation(); onSelect(report); }} size="sm" type="button" variant="secondary" /></AdminTableCell>
            </AdminTableRow>
          ))}
        </tbody>
      </AdminTable>
    </section>
  );
}

function EvidenceGrid({ reports, onSelect }) {
  if (!reports.length) return <EmptyState title="Sin evidencias" description="Los trabajos con evidencia apareceran aqui." />;
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {reports.map((report) => (
        <article className="rounded-card border border-park-border bg-white p-4 shadow-card" key={report.id}>
          <Thumb evidence={report.evidences?.[0]} />
          <p className="mt-3 text-xs font-black uppercase text-park-muted">{report.code}</p>
          <h3 className="font-black text-park-black">{report.description}</h3>
          <p className="text-sm text-park-muted">{locationLabel(report)}</p>
          <div className="mt-3 flex items-center justify-between gap-2">
            <StatusBadge value={report.status} />
            <Button className="h-8 w-8 px-0" icon={Eye} onClick={() => onSelect(report)} size="sm" type="button" variant="secondary" />
          </div>
        </article>
      ))}
    </section>
  );
}

function MaintenanceDetail({ report, onClose }) {
  return (
    <AdminDrawer open={true} onClose={onClose} title={report.code} width="w-full max-w-xl">
      <div className="flex gap-2 mb-4"><StatusBadge value={report.status} /><StatusBadge value={report.priority} /></div>
      <Panel title="Informacion general">
        <DetailRow label="Ubicacion" value={locationLabel(report)} />
        <DetailRow label="Tipo" value={report.type?.replaceAll("_", " ")} />
        <DetailRow label="Origen" value={report.area} />
        <DetailRow label="Descripcion" value={report.description} />
        <DetailRow label="Reportado por" value={report.reportedBy ? `${report.reportedBy.firstName} ${report.reportedBy.lastName}` : "No registrado"} />
        <DetailRow label="Fecha" value={formatDateTime(report.createdAt)} />
        <DetailRow label="Tecnico" value={report.resolvedBy ? `${report.resolvedBy.firstName} ${report.resolvedBy.lastName}` : "Sin asignar"} />
      </Panel>
      <Panel title="Evidencia inicial">
        <div className="grid gap-2 md:grid-cols-2">{report.evidences?.length ? report.evidences.map((item) => <Thumb evidence={item} key={item.id} />) : <p className="text-sm text-park-muted">Sin evidencias adjuntas.</p>}</div>
      </Panel>
      <Panel title="Historial">
        {historyFor(report).map((item) => <div className="flex gap-3 pb-3 last:pb-0" key={item}><span className="mt-1 h-2.5 w-2.5 rounded-full bg-park-green" /><p className="text-sm font-semibold text-park-black">{item}</p></div>)}
      </Panel>
    </AdminDrawer>
  );
}

function Metric({ icon: Icon, label, value, tone }) {
  const tones = { gold: "bg-park-gold-soft text-park-gold", blue: "bg-blue-50 text-blue-700", green: "bg-park-green-soft text-park-green", red: "bg-red-50 text-park-danger", purple: "bg-purple-50 text-purple-700" };
  return <article className="rounded-card border border-park-border bg-white p-5 shadow-card"><span className={`grid h-11 w-11 place-items-center rounded-button ${tones[tone]}`}><Icon size={20} /></span><p className="mt-4 text-sm font-semibold text-park-muted">{label}</p><strong className="font-display text-[28px] font-semibold text-park-dark">{value}</strong></article>;
}

function Panel({ title, children }) {
  return <section className="mt-5 rounded-card border border-park-border bg-white p-5 shadow-card"><h2 className="mb-4 font-sans text-lg font-black text-park-black">{title}</h2>{children}</section>;
}

function DetailRow({ label, value }) {
  if (!value) return null;
  return <div className="mb-3 grid grid-cols-[120px_1fr] gap-3 text-sm last:mb-0"><span className="font-semibold text-park-muted">{label}</span><strong className="text-park-black">{value}</strong></div>;
}

function Thumb({ evidence }) {
  if (!evidence) return <div className="grid h-32 place-items-center rounded-card border border-dashed border-park-border bg-park-bg text-sm text-park-muted">Sin evidencia</div>;
  return <ImagePreview className="h-32 w-full" path={evidence.imageUrl || evidence.fileUrl} alt={evidence.fileName || "Evidencia"} />;
}

function filterReports(view, reports) {
  if (view === "solicitudes") return reports.filter((report) => report.status === "ABIERTO");
  if (view === "reparacion") return reports.filter((report) => report.status === "EN_REVISION");
  if (view === "finalizados") return reports.filter((report) => report.status === "RESUELTO");
  if (view === "evidencias") return reports.filter((report) => report.evidences?.length);
  return reports;
}

function pageTitle(view) {
  const titles = { resumen: "Mantenimiento - Resumen", solicitudes: "Mantenimiento - Solicitudes", reparacion: "Mantenimiento - En reparacion", finalizados: "Mantenimiento - Finalizados", evidencias: "Mantenimiento - Evidencias" };
  return titles[view] || titles.resumen;
}

function locationLabel(report) {
  if (report.room?.number) return `Habitacion ${report.room.number}`;
  if (report.product?.name) return report.product.name;
  return report.area || "Area operativa";
}

function historyFor(report) {
  const steps = ["Reportado"];
  if (report.status === "EN_REVISION" || report.status === "RESUELTO") steps.push("Reparacion iniciada");
  if (report.evidences?.length) steps.push("Evidencia agregada");
  if (report.status === "RESUELTO") steps.push("Finalizado");
  return steps;
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
