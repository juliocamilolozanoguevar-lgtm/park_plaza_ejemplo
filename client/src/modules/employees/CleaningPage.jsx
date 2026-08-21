import { useMemo, useState } from "react";
import { Camera, CheckCircle2, Eye, FileWarning, Upload, X } from "lucide-react";
import { useLocation } from "react-router-dom";
import { api, getToken } from "../../services/api";
import { useFetch } from "../../hooks/useFetch";
import { EmptyState } from "../../components/EmptyState";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { StatusBadge } from "../../components/StatusBadge";
import { Toast } from "../../components/Toast";
import { Button, Input as UiInput, PageHeader, Select as UiSelect } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { ModuleNav } from "../../components/ui/ModuleNav";
import { API_ROOT } from "../../services/api";
import { ImagePreview } from "../../components/ImagePreview";

export function CleaningPage() {
  const { can } = useAuth();
  const canCreate = can("LIMPIEZA", "CREAR");
  const canEdit = can("LIMPIEZA", "EDITAR");
  const location = useLocation();
  const isEvidence = location.pathname.includes("evidencias");
  const isFinished = location.pathname.includes("finalizadas");
  const endpoint = isFinished ? "/cleaning/tasks?status=FINALIZADA" : "/cleaning/tasks";
  const { data, loading, reload } = useFetch(endpoint, { initialData: [] });
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(isFinished ? "FINALIZADA" : "");
  const [modal, setModal] = useState(null);
  const [pendingFinish, setPendingFinish] = useState(null);
  const [selected, setSelected] = useState(null);

  const rows = useMemo(() => (data || []).filter((task) => {
    const matchesStatus = !status || task.status === status;
    const matchesSearch = !search || task.room?.number?.includes(search);
    const matchesRoute = isFinished ? task.status === "FINALIZADA" : task.status !== "FINALIZADA";
    return matchesStatus && matchesSearch && (isEvidence || matchesRoute);
  }), [data, status, search, isFinished, isEvidence]);

  async function startTask(task) {
    await api(`/cleaning/tasks/${task.id}/start`, { method: "PATCH" });
    setToast(`Limpieza iniciada en habitacion ${task.room.number}.`);
    reload();
  }

  async function finishTask(task) {
    await api(`/cleaning/tasks/${task.id}/finish`, { method: "PATCH" });
    setToast(`Habitacion ${task.room.number} finalizada y liberada.`);
    setPendingFinish(null);
    reload();
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-5">
      <Toast message={toast} onClose={() => setToast("")} />
      <PageHeader
        eyebrow="Limpieza"
        title={isEvidence ? "Evidencias de limpieza" : isFinished ? "Habitaciones finalizadas" : "Habitaciones pendientes"}
        description="Controla el avance del equipo, adjunta evidencias y registra incidencias por habitacion."
      />
      <ModuleNav items={[
        { label: "Pendientes", href: "/limpieza/pendientes" },
        { label: "Finalizadas", href: "/limpieza/finalizadas" },
        { label: "Evidencias", href: "/limpieza/evidencias" }
      ]} />
      <section className="rounded-card border border-park-border bg-white p-5 shadow-card">
        <div className="grid gap-3 md:grid-cols-3">
          <UiInput placeholder="Buscar habitacion..." value={search} onChange={(event) => setSearch(event.target.value)} />
          <UiSelect value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Todos los estados</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="EN_LIMPIEZA">En limpieza</option>
            <option value="FINALIZADA">Finalizada</option>
          </UiSelect>
          <UiInput type="date" />
        </div>
      </section>

      {!rows.length ? <EmptyState /> : (
        <div className="grid gap-4 xl:grid-cols-2">
          {rows.map((task) => (
            <article key={task.id} className="rounded-card border border-park-border bg-white p-5 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black text-park-text">Habitacion {task.room.number}</h3>
                  <p className="text-sm text-park-muted">{task.room.type?.name} - Empleado: {task.assignedTo || "Sin asignar"} - Prioridad {task.priority}</p>
                </div>
                <StatusBadge value={task.status} />
              </div>

              <EvidenceSummary task={task} />

              {task.operationalReports?.[0] && (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
                  <strong>Incidencia:</strong> {task.operationalReports[0].description}
                  <span className="ml-2 font-black text-amber-700">{task.operationalReports[0].priority}</span>
                </div>
              )}

              <div className="mt-5 flex flex-wrap gap-2">
                {canEdit && task.status === "PENDIENTE" && <Button type="button" onClick={() => startTask(task)}>Iniciar revision</Button>}
                {canCreate ? <Button type="button" variant="secondary" icon={Camera} onClick={() => setModal({ type: "evidence", task, evidenceType: "ENTRADA" })}>Evid. entrada</Button> : null}
                {canCreate && task.status !== "PENDIENTE" && <Button type="button" variant="secondary" icon={Camera} onClick={() => setModal({ type: "evidence", task, evidenceType: "SALIDA" })}>Evid. salida</Button>}
                {canCreate ? <Button type="button" variant="gold" icon={FileWarning} onClick={() => setModal({ type: "report", task })}>Reportar incidencia</Button> : null}
                {(isFinished || isEvidence) && <Button type="button" variant="secondary" icon={Eye} onClick={() => setSelected(task)}>Ver detalle</Button>}
                {canEdit && task.status !== "FINALIZADA" && <Button type="button" variant="gold" onClick={() => task.evidences?.length ? finishTask(task) : setPendingFinish(task)}>Finalizar revision</Button>}
              </div>
            </article>
          ))}
        </div>
      )}

      {modal?.type === "evidence" && <EvidenceModal evidenceType={modal.evidenceType} task={modal.task} onClose={() => setModal(null)} onSaved={() => { setModal(null); setToast("Evidencia guardada."); reload(); }} />}
      {modal?.type === "report" && <ReportModal task={modal.task} onClose={() => setModal(null)} onSaved={() => { setModal(null); setToast("Incidencia registrada."); reload(); }} />}
      {selected ? <ReviewDetail task={selected} onClose={() => setSelected(null)} /> : null}
      {pendingFinish ? (
        <ConfirmDialog
          title="Finalizar sin evidencia"
          description={`La habitacion ${pendingFinish.room.number} no tiene evidencia adjunta. Puedes finalizarla, pero quedara sin respaldo visual.`}
          confirmLabel="Finalizar limpieza"
          onCancel={() => setPendingFinish(null)}
          onConfirm={() => finishTask(pendingFinish)}
        />
      ) : null}
    </div>
  );
}

function EvidenceSummary({ task }) {
  const groups = splitEvidence(task.evidences);
  return (
    <div className="mt-4 grid gap-3 md:grid-cols-3">
      <StateTile label="Entrada" value={groups.entry.length ? "Registrada" : "Pendiente"} ok={groups.entry.length > 0} />
      <StateTile label="Salida" value={groups.exit.length ? "Registrada" : "Pendiente"} ok={groups.exit.length > 0} />
      <StateTile label="Danos" value={task.operationalReports?.length ? `${task.operationalReports.length} novedad(es)` : "Sin reporte"} ok={!task.operationalReports?.length} />
    </div>
  );
}

function StateTile({ label, value, ok }) {
  return (
    <div className="rounded-card border border-park-border bg-park-bg p-3">
      <p className="text-xs font-black uppercase text-park-muted">{label}</p>
      <p className={`mt-1 flex items-center gap-2 text-sm font-black ${ok ? "text-park-green" : "text-park-gold"}`}>
        {ok ? <CheckCircle2 size={15} /> : <FileWarning size={15} />}
        {value}
      </p>
    </div>
  );
}

function ReviewDetail({ task, onClose }) {
  const groups = splitEvidence(task.evidences);
  return (
    <Modal title={`Detalle de revision - Habitacion ${task.room.number}`} onClose={onClose}>
      <div className="grid gap-5 xl:grid-cols-[1fr_1.2fr]">
        <section>
          <h4 className="mb-3 font-sans text-lg font-black text-park-black">Informacion general</h4>
          <div className="grid gap-3">
            <InfoRow label="Tipo" value={task.room?.type?.name} />
            <InfoRow label="Prioridad" value={task.priority} />
            <InfoRow label="Estado" value={<StatusBadge value={task.status} />} />
            <InfoRow label="Empleado" value={task.assignedTo || "Sin asignar"} />
            <InfoRow label="Inicio" value={formatDateTime(task.startedAt)} />
            <InfoRow label="Finalizacion" value={formatDateTime(task.finishedAt)} />
          </div>
        </section>
        <section>
          <h4 className="mb-3 font-sans text-lg font-black text-park-black">Evidencias</h4>
          <EvidenceGallery label="Entrada" items={groups.entry} />
          <EvidenceGallery label="Salida" items={groups.exit} />
        </section>
      </div>
      <section className="mt-5">
        <h4 className="mb-3 font-sans text-lg font-black text-park-black">Novedades / Danos</h4>
        {task.operationalReports?.length ? (
          <div className="grid gap-3">
            {task.operationalReports.map((report) => (
              <div className="rounded-card border border-amber-200 bg-amber-50 p-3" key={report.id}>
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-park-black">{report.description}</p>
                  <StatusBadge value={report.priority} />
                </div>
              </div>
            ))}
          </div>
        ) : <p className="rounded-card bg-park-bg p-3 text-sm text-park-muted">Sin novedades registradas.</p>}
      </section>
    </Modal>
  );
}

function EvidenceGallery({ label, items }) {
  return (
    <div className="mb-4">
      <p className="mb-2 text-sm font-black text-park-black">{label}</p>
      {items.length ? (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {items.map((evidence) => <ImagePreview className="h-24 w-full" key={evidence.id} path={evidence.imageUrl || evidence.fileUrl} alt={evidence.description || "Evidencia"} />)}
        </div>
      ) : <p className="rounded-card bg-park-bg p-3 text-sm text-park-muted">Sin evidencia de {label.toLowerCase()}.</p>}
    </div>
  );
}

function InfoRow({ label, value }) {
  return <div className="rounded-card bg-park-bg p-3"><p className="text-xs font-black uppercase text-park-muted">{label}</p><div className="mt-1 font-semibold text-park-black">{value || "No registrado"}</div></div>;
}

function EvidenceModal({ task, evidenceType = "ENTRADA", onClose, onSaved }) {
  const [files, setFiles] = useState([]);
  const [description, setDescription] = useState("");

  async function submit(event) {
    event.preventDefault();
    const uploaded = await uploadImages(files);
    await api(`/cleaning/tasks/${task.id}/evidence`, { method: "POST", body: { description: `${evidenceType}: ${description || "Evidencia registrada"}`, files: uploaded } });
    onSaved();
  }

  return (
    <Modal title={`Evidencia de ${evidenceType.toLowerCase()} - Habitacion ${task.room.number}`} onClose={onClose}>
      <form className="space-y-4" onSubmit={submit}>
        <Info task={task} />
        <ImagePicker files={files} setFiles={setFiles} />
        <textarea className="min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Descripcion / observacion" value={description} onChange={(event) => setDescription(event.target.value)} />
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button><Button>Guardar evidencia</Button></div>
      </form>
    </Modal>
  );
}

function ReportModal({ task, onClose, onSaved }) {
  const [files, setFiles] = useState([]);
  const [form, setForm] = useState({ type: "DANO_INFRAESTRUCTURA", priority: "ALTA", description: "" });

  async function submit(event) {
    event.preventDefault();
    const uploaded = files.length ? await uploadImages(files) : [];
    await api(`/cleaning/tasks/${task.id}/report`, { method: "POST", body: { ...form, files: uploaded } });
    onSaved();
  }

  return (
    <Modal title={`Reportar incidencia - Habitacion ${task.room.number}`} onClose={onClose}>
      <form className="space-y-4" onSubmit={submit}>
        <Info task={task} />
        <div className="grid gap-3 md:grid-cols-2">
          <Select label="Tipo" value={form.type} onChange={(type) => setForm({ ...form, type })} options={["DANO_INFRAESTRUCTURA", "MANTENIMIENTO", "OBJETO_PERDIDO", "FALTA_INSUMO", "INCIDENCIA", "OTRO"]} />
          <Select label="Prioridad" value={form.priority} onChange={(priority) => setForm({ ...form, priority })} options={["BAJA", "MEDIA", "ALTA", "CRITICA"]} />
        </div>
        <textarea className="min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Descripcion del dano o incidencia" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} required />
        <ImagePicker files={files} setFiles={setFiles} />
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button><Button>Guardar incidencia</Button></div>
      </form>
    </Modal>
  );
}

function ImagePicker({ files, setFiles }) {
  const previews = files.map((file) => ({ file, url: URL.createObjectURL(file) }));
  return (
    <div>
      <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-bold text-park-muted">
        <Upload className="mb-2" />
        Subir imagenes JPG, PNG o WEBP
        <input className="hidden" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => setFiles([...files, ...Array.from(event.target.files || [])])} />
      </label>
      {previews.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{previews.map(({ file, url }) => <div key={url} className="relative"><img className="h-20 w-24 rounded-lg object-cover" src={url} alt={file.name} /><button type="button" className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-red-600 text-white" onClick={() => setFiles(files.filter((item) => item !== file))}><X size={14} /></button></div>)}</div>}
    </div>
  );
}

async function uploadImages(files) {
  if (!files.length) return [];
  const body = new FormData();
  files.forEach((file) => body.append("images", file));
  const response = await fetch(`${API_ROOT}/api/cleaning/evidence/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getToken()}` },
    body
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || "No fue posible subir las imagenes.");
  return data.files;
}

function Info({ task }) {
  return <div className="rounded-lg bg-slate-50 p-3 text-sm text-park-muted">Habitacion / zona: <strong>{task.room.number}</strong> - Empleado: <strong>{task.assignedTo || "Lidia"}</strong> - Fecha y hora automatica</div>;
}

function Modal({ title, children, onClose }) {
  return <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/30 p-4"><section className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-card bg-white p-5 shadow-drawer"><div className="mb-4 flex items-center justify-between"><h3 className="font-display text-xl font-semibold text-park-dark">{title}</h3><Button type="button" variant="ghost" onClick={onClose}>Cerrar</Button></div>{children}</section></div>;
}

function ConfirmDialog({ title, description, confirmLabel, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/35 p-4">
      <div className="w-full max-w-md rounded-card bg-white p-5 shadow-drawer">
        <h3 className="font-display text-xl font-semibold text-park-dark">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-park-muted">{description}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>Volver</Button>
          <Button type="button" variant="danger" onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return <UiSelect label={label} value={value} onChange={(event) => onChange(event.target.value)}>{options.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</UiSelect>;
}

function splitEvidence(evidences = []) {
  const entry = evidences.filter((item) => /entrada/i.test(item.description || item.notes || ""));
  const exit = evidences.filter((item) => /salida/i.test(item.description || item.notes || ""));
  if (!entry.length && !exit.length && evidences.length) {
    return { entry: evidences.slice(-1), exit: evidences.length > 1 ? evidences.slice(0, 1) : [] };
  }
  return { entry, exit };
}

function formatDateTime(value) {
  if (!value) return "No registrado";
  return new Date(value).toLocaleString("es-PE");
}
