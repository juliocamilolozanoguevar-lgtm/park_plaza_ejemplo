import { CalendarClock, CheckCircle2, Clock, DoorOpen, Eye, Search, UserCheck, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { EmptyState } from "../../components/EmptyState";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { StatusBadge } from "../../components/StatusBadge";
import { Toast } from "../../components/Toast";
import { Button, ModuleNav, PageHeader } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { useFetch } from "../../hooks/useFetch";
import { api, getImageUrl } from "../../services/api";

const tabs = [
  { label: "Resumen", href: "/asistencia" },
  { label: "Hoy", href: "/asistencia/hoy" },
  { label: "Historial", href: "/asistencia/historial" }
];

const areaTabs = [
  { label: "Todos", value: "TODOS" },
  { label: "Recepcion", value: "RECEPCIONISTA" },
  { label: "Restaurante", value: "RESTAURANTE" },
  { label: "Bartender", value: "BARTENDER" },
  { label: "Limpieza", value: "LIMPIEZA" },
  { label: "Mantenimiento", value: "MANTENIMIENTO" }
];

export function AttendancePage({ view = "resumen" }) {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialStatus = params.get("status") || "TODOS";
  const [filters, setFilters] = useState({ search: "", area: "TODOS", status: initialStatus, from: "", to: "" });
  const [drawer, setDrawer] = useState(null);
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);
  const isHistory = view === "historial";
  const query = buildQuery(filters, isHistory);
  const listPath = isHistory ? `/asistencia/history${query}` : `/asistencia/today${query}`;
  const { data: summary, loading: summaryLoading, reload: reloadSummary } = useFetch("/asistencia/summary", { initialData: {} });
  const { data, loading, error, reload } = useFetch(listPath, { initialData: [] });
  const records = Array.isArray(data) ? data : [];
  const recentRecords = useMemo(() => sortRecent(records).slice(0, 10), [records]);

  async function correct(record) {
    const reason = window.prompt("Motivo de correccion");
    if (!reason) return;
    setSaving(true);
    try {
      await api(`/asistencia/${record.id}/correct`, { method: "PATCH", body: { reason, status: record.checkOutAt ? "FINALIZADA" : "REQUIERE_REVISION" } });
      await Promise.all([reload(), reloadSummary()]);
      setDrawer(null);
      setToast("Asistencia corregida y auditada.");
    } finally {
      setSaving(false);
    }
  }

  function updateFilter(key, value) {
    setFilters((state) => ({ ...state, [key]: value }));
  }

  if (summaryLoading || loading) return <LoadingSpinner />;
  if (error) return <p className="rounded-card bg-park-danger-soft p-4 font-semibold text-park-danger">{error.message}</p>;

  return (
    <div className="space-y-5">
      <Toast message={toast} onClose={() => setToast("")} />
      <PageHeader
        eyebrow="Administracion / Asistencia"
        title="Control de Asistencia"
        description="Consulta entradas, salidas y jornadas del personal."
        actions={<Button as={Link} to="/asistencia/marcar" target="_blank" icon={DoorOpen}>Abrir terminal</Button>}
      />
      <ModuleNav items={tabs} />
      <CompactMetrics summary={summary} navigate={navigate} />
      <AreaTabs value={filters.area} onChange={(value) => updateFilter("area", value)} />
      <Filters filters={filters} setFilters={setFilters} history={isHistory} />
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-card border border-park-border bg-white p-4 shadow-card">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-sans text-lg font-black text-park-black">Asistencia / Marcaciones</h2>
              <p className="text-sm text-park-muted">{records.length} registro(s) encontrados</p>
            </div>
            <StatusBadge value={filters.area === "TODOS" ? "TODOS" : filters.area} />
          </div>
          <RecordsTable records={records} onDetail={setDrawer} />
        </div>
        <RecentRecords records={recentRecords} onDetail={setDrawer} />
      </section>
      {drawer ? <AttendanceDrawer record={drawer} canCorrect={can("ASISTENCIA", "EDITAR")} saving={saving} onCorrect={correct} onClose={() => setDrawer(null)} /> : null}
    </div>
  );
}

function CompactMetrics({ summary, navigate }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Metric icon={UserCheck} label="Presentes" value={summary.present || 0} onClick={() => navigate("/asistencia/hoy?status=PRESENTE")} />
      <Metric icon={CalendarClock} label="Entradas" value={summary.todayEntries || 0} onClick={() => navigate("/asistencia/hoy")} />
      <Metric icon={CheckCircle2} label="Salidas" value={summary.exits || 0} onClick={() => navigate("/asistencia/hoy?status=FINALIZADA")} />
      <Metric icon={Clock} label="Abiertas" value={summary.openShifts || 0} onClick={() => navigate("/asistencia/hoy?status=PRESENTE")} />
      <Metric icon={Eye} label="Revision" value={summary.reviewRequired || 0} tone="warn" onClick={() => navigate("/asistencia/historial?status=REQUIERE_REVISION")} />
    </section>
  );
}

function AreaTabs({ value, onChange }) {
  return (
    <section className="max-w-full overflow-x-auto rounded-card border border-park-border bg-white p-2 shadow-card">
      <div className="flex min-w-max gap-2">
        {areaTabs.map((area) => (
          <button
            className={`rounded-button px-4 py-2 text-sm font-black transition ${value === area.value ? "bg-park-green text-white" : "bg-park-bg text-park-muted hover:text-park-black"}`}
            key={area.value}
            onClick={() => onChange(area.value)}
            type="button"
          >
            {area.label}
          </button>
        ))}
      </div>
    </section>
  );
}

function Filters({ filters, setFilters, history }) {
  function update(key, value) {
    setFilters((state) => ({ ...state, [key]: value }));
  }

  function clear() {
    setFilters({ search: "", area: "TODOS", status: "TODOS", from: "", to: "" });
  }

  return (
    <section className="grid gap-3 rounded-card border border-park-border bg-white p-4 shadow-card lg:grid-cols-[1fr_190px_150px_150px_auto] lg:items-end">
      <label className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-park-muted" size={17} />
        <input
          className="h-11 w-full rounded-input border border-park-border px-3 pl-10 text-sm outline-none focus:border-park-green"
          placeholder="Buscar trabajador, DNI o correo..."
          value={filters.search}
          onChange={(event) => update("search", event.target.value)}
        />
      </label>
      <Select label="Estado" value={filters.status} onChange={(value) => update("status", value)} options={["TODOS", "PRESENTE", "FINALIZADA", "REQUIERE_REVISION"]} />
      {history ? (
        <>
          <InputDate label="Desde" value={filters.from} onChange={(value) => update("from", value)} />
          <InputDate label="Hasta" value={filters.to} onChange={(value) => update("to", value)} />
        </>
      ) : (
        <>
          <span />
          <span />
        </>
      )}
      <Button type="button" variant="secondary" onClick={clear}>Limpiar</Button>
    </section>
  );
}

function RecordsTable({ records, onDetail }) {
  if (!records.length) return <EmptyState title="Sin registros" description="No hay registros de asistencia para los filtros seleccionados." />;
  const columns = ["Trabajador", "Area", "Entrada", "Salida", "Estado", "Accion"];
  return (
    <div className="overflow-x-auto rounded-card border border-park-border bg-white">
      <table className="min-w-[720px] text-left text-sm">
        <thead className="bg-park-bg text-xs uppercase text-park-muted">
          <tr>{columns.map((col) => <th className="px-4 py-3 font-black" key={col}>{col}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-park-border">
          {records.map((item) => (
            <tr key={item.id} className="hover:bg-park-green-soft/20">
              <td className="px-4 py-3">
                <p className="font-black text-park-black">{fullName(item.worker)}</p>
                <p className="text-xs text-park-muted">DNI {item.worker?.documentNumber || "-"}</p>
              </td>
              <td className="px-4 py-3 font-semibold text-park-black">{areaLabel(item.worker?.role?.name)}</td>
              <td className="px-4 py-3">{formatTime(item.checkInAt)}</td>
              <td className="px-4 py-3">{formatTime(item.checkOutAt)}</td>
              <td className="px-4 py-3"><StatusBadge value={item.status} /></td>
              <td className="px-4 py-3">
                <button className="grid h-9 w-9 place-items-center rounded-button border border-park-border hover:border-park-green" onClick={() => onDetail(item)} type="button" aria-label="Ver detalle">
                  <Eye size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RecentRecords({ records, onDetail }) {
  return (
    <aside className="rounded-card border border-park-border bg-white p-4 shadow-card">
      <div className="mb-3">
        <h2 className="font-sans text-lg font-black text-park-black">Registros recientes</h2>
        <p className="text-sm text-park-muted">Ultimos 10 movimientos visibles</p>
      </div>
      <div className="space-y-2">
        {records.length ? records.map((item) => (
          <button className="w-full rounded-card border border-park-border p-3 text-left transition hover:border-park-green hover:bg-park-green-soft/20" key={item.id} onClick={() => onDetail(item)} type="button">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-black text-park-black">{fullName(item.worker)}</p>
                <p className="text-xs font-semibold uppercase text-park-muted">{areaLabel(item.worker?.role?.name)}</p>
              </div>
              <span className="shrink-0 rounded-full bg-park-green-soft px-2 py-1 text-[10px] font-black uppercase text-park-green">{markType(item)}</span>
            </div>
            <p className="mt-2 text-xs text-park-muted">{formatDateTime(latestDate(item))}</p>
            <div className="mt-2"><StatusBadge value={item.status} /></div>
          </button>
        )) : <EmptyState title="Sin actividad" description="No hay movimientos recientes para los filtros actuales." />}
      </div>
    </aside>
  );
}

function AttendanceDrawer({ record, canCorrect, saving, onCorrect, onClose }) {
  return <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-xl overflow-auto border-l border-park-border bg-white p-6 shadow-drawer"><div className="flex items-start justify-between"><div><p className="text-xs font-black uppercase text-park-gold">Asistencia</p><h2 className="font-sans text-2xl font-black text-park-black">{fullName(record.worker)}</h2></div><button className="grid h-9 w-9 place-items-center rounded-button border border-park-border" onClick={onClose} type="button"><X size={18} /></button></div><section className="mt-5 rounded-card border border-park-green-soft bg-park-green-soft/30 p-4"><div className="flex items-center gap-4"><Avatar user={record.worker} /><div><h3 className="font-black text-park-black">{fullName(record.worker)}</h3><p className="text-sm text-park-muted">{areaLabel(record.worker?.role?.name)} | DNI {record.worker?.documentNumber || "-"}</p><StatusBadge value={record.status} /></div></div></section><section className="mt-5 space-y-3"><Detail label="Entrada" value={formatDateTime(record.checkInAt)} /><Detail label="Salida" value={formatDateTime(record.checkOutAt)} /><Detail label="Duracion" value={duration(record.durationMinutes)} /><Detail label="Estado" value={record.status} /><Detail label="Revision" value={record.reviewReason} /><Detail label="Correccion" value={record.correctionReason} /></section><div className="mt-6 flex flex-wrap justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cerrar</Button>{canCorrect ? <Button type="button" loading={saving} onClick={() => onCorrect(record)}>Corregir / revisar</Button> : null}</div></aside>;
}

function Metric({ icon: Icon, label, value, tone = "green", onClick }) {
  const styles = tone === "warn" ? "bg-park-gold-soft text-park-gold" : "bg-park-green-soft text-park-green";
  return <button className="rounded-card border border-park-border bg-white p-3 text-left shadow-card transition hover:border-park-green focus:outline-none focus:ring-2 focus:ring-park-green/20" onClick={onClick} type="button"><div className="flex items-center gap-3"><span className={`grid h-10 w-10 place-items-center rounded-button ${styles}`}><Icon size={19} /></span><div><strong className="font-display text-xl text-park-dark">{value}</strong><p className="text-sm font-black text-park-black">{label}</p></div></div></button>;
}

function Select({ label, value, onChange, options }) {
  return <label><span className="text-xs font-black uppercase text-park-muted">{label}</span><select className="mt-2 h-11 w-full rounded-input border border-park-border bg-white px-3 text-sm outline-none focus:border-park-green" value={value} onChange={(event) => onChange(event.target.value)}>{options.map((item) => <option key={item} value={item}>{item === "TODOS" ? "Todos" : item.replaceAll("_", " ")}</option>)}</select></label>;
}

function InputDate({ label, value, onChange }) {
  return <label><span className="text-xs font-black uppercase text-park-muted">{label}</span><input className="mt-2 h-11 w-full rounded-input border border-park-border px-3 text-sm outline-none focus:border-park-green" type="date" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function Detail({ label, value }) {
  return <div className="flex items-center justify-between rounded-card bg-park-bg px-4 py-3 text-sm"><span className="font-black uppercase text-park-muted">{label}</span><strong className="text-right text-park-black">{value || "-"}</strong></div>;
}

function Avatar({ user }) {
  const [failed, setFailed] = useState(false);
  if (user?.photoUrl && !failed) return <img className="h-16 w-16 rounded-full object-cover" src={getImageUrl(user.photoUrl)} alt={fullName(user)} onError={() => setFailed(true)} />;
  return <span className="grid h-16 w-16 place-items-center rounded-full bg-park-green font-black text-white">{initials(user)}</span>;
}

function buildQuery(filters, history) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value && value !== "TODOS" && (history || !["from", "to"].includes(key))) params.set(key, value);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

function sortRecent(records) {
  return [...records].sort((a, b) => new Date(latestDate(b)).getTime() - new Date(latestDate(a)).getTime());
}

function latestDate(record) {
  return record?.checkOutAt || record?.checkInAt;
}

function markType(record) {
  return record?.checkOutAt ? "Salida" : "Entrada";
}

function areaLabel(role) {
  if (role === "RECEPCIONISTA") return "Recepcion";
  return role ? role.replaceAll("_", " ") : "-";
}

function fullName(user) {
  return [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Trabajador";
}

function initials(user) {
  return fullName(user).split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function formatTime(value) {
  return value ? new Date(value).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }) : "-";
}

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString("es-PE") : "-";
}

function duration(value) {
  if (!value) return "-";
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return hours ? `${hours} h ${minutes} min` : `${minutes} min`;
}
