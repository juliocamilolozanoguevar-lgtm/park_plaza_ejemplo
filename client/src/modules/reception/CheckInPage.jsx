import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { CalendarCheck, CheckCircle2, ClipboardCheck, QrCode, Search, UserCheck } from "lucide-react";
import { api } from "../../services/api";
import { StatusBadge } from "../../components/StatusBadge";
import { Toast } from "../../components/Toast";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { Button, Input, PageHeader, Tabs } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";

export function CheckInPage() {
  const location = useLocation();
  const { can } = useAuth();
  const canCreate = can("CHECK_IN", "CREAR");
  const initialSearch = new URLSearchParams(location.search).get("search") || "";
  const [search, setSearch] = useState(initialSearch);
  const [rows, setRows] = useState([]);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("HOY");

  useEffect(() => {
    load(initialSearch);
  }, []);

  const metrics = useMemo(() => {
    const todayRows = rows.filter((reservation) => isToday(reservation.checkInDate));
    return {
      today: todayRows.length,
      pending: todayRows.filter((reservation) => !reservation.stay && ["CONFIRMADA", "PENDIENTE"].includes(reservation.status)).length,
      completed: todayRows.filter((reservation) => reservation.stay || reservation.status === "CHECKED_IN").length
    };
  }, [rows]);

  const visibleRows = useMemo(() => rows.filter((reservation) => {
    if (tab === "HOY") return isToday(reservation.checkInDate);
    if (tab === "PENDIENTES") return !reservation.stay && ["CONFIRMADA", "PENDIENTE"].includes(reservation.status);
    if (tab === "COMPLETADOS") return Boolean(reservation.stay) || reservation.status === "CHECKED_IN";
    return true;
  }), [rows, tab]);

  async function load(term = "") {
    setLoading(true);
    setError("");
    try {
      setRows(await api(`/checkin/search?search=${encodeURIComponent(term)}`));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function runSearch(event) {
    event.preventDefault();
    load(search);
  }

  async function doCheckIn(id) {
    if (!canCreate) return setError("No tienes permiso para realizar check-in.");
    try {
      await api("/checkin", { method: "POST", body: { reservationId: id } });
      setToast("Check-in realizado.");
      await load(search);
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-5">
      <Toast message={toast} onClose={() => setToast("")} />
      <PageHeader
        eyebrow="Recepcion"
        title="Check-in"
        description="Registra llegadas de huespedes usando reservas, DNI, codigo o habitacion."
        actions={<Button variant="secondary" icon={QrCode} type="button" disabled>Escanear QR</Button>}
      />

      <section className="grid gap-4 md:grid-cols-3">
        <CompactMetric icon={CalendarCheck} label="Llegadas hoy" value={metrics.today} />
        <CompactMetric icon={ClipboardCheck} label="Pendientes" value={metrics.pending} tone="gold" />
        <CompactMetric icon={UserCheck} label="Completados" value={metrics.completed} />
      </section>

      <section className="rounded-card border border-park-border bg-white p-5 shadow-card">
        <form className="flex flex-col gap-3 md:flex-row" onSubmit={runSearch}>
          <Input className="flex-1" placeholder="Buscar por DNI, reserva, cliente o habitacion" value={search} onChange={(event) => setSearch(event.target.value)} />
          <Button icon={Search} type="submit">Buscar</Button>
        </form>
        {error ? <p className="mt-3 rounded-card bg-park-danger-soft px-3 py-2 text-sm font-semibold text-park-danger">{error}</p> : null}
      </section>

      <Tabs
        tabs={[
          { value: "HOY", label: `Llegadas hoy (${metrics.today})` },
          { value: "PENDIENTES", label: `Pendientes (${metrics.pending})` },
          { value: "COMPLETADOS", label: `Completados (${metrics.completed})` },
          { value: "TODOS", label: "Todos" }
        ]}
        value={tab}
        onChange={setTab}
      />

      <section className="grid gap-4">
        {visibleRows.map((reservation) => {
          const ready = !reservation.stay && ["CONFIRMADA", "PENDIENTE"].includes(reservation.status);
          return (
            <article className="rounded-card border border-park-border bg-white p-5 shadow-card" key={reservation.id}>
              <div className="grid gap-4 xl:grid-cols-[96px_1fr_120px_1fr_auto] xl:items-center">
                <div>
                  <p className="font-display text-[28px] font-semibold text-park-dark">{time(reservation.checkInDate)}</p>
                  <Button size="sm" variant="secondary" type="button">Ver detalles</Button>
                </div>
                <div>
                  <h2 className="font-display text-lg font-semibold text-park-black">{reservation.client.firstName} {reservation.client.lastName}</h2>
                  <p className="text-sm text-park-muted">DNI: {reservation.client.documentNumber}</p>
                  <p className="mt-1 text-xs font-semibold text-park-muted">{reservation.code}</p>
                </div>
                <div className="rounded-card border border-park-border bg-park-bg px-4 py-3 text-center">
                  <strong className="block font-display text-2xl font-semibold text-park-dark">{reservation.room.number}</strong>
                  <span className="text-xs text-park-muted">{reservation.room.type?.name}</span>
                </div>
                <div className="grid gap-1 text-sm">
                  <Info label="Entrada" value={date(reservation.checkInDate)} />
                  <Info label="Noches" value={nights(reservation)} />
                  <Info label="Huespedes" value={`${reservation.adults} adultos, ${reservation.children} ninos`} />
                </div>
                <div className="rounded-card bg-park-bg p-3 text-sm">
                  <p className="mb-2 font-semibold text-park-black">Estado de datos</p>
                  <Checklist ok label="Reserva registrada" />
                  <Checklist ok={reservation.room.status !== "MANTENIMIENTO"} label="Habitacion preparada" />
                  <Checklist ok={Number(reservation.advance) > 0} label="Adelanto registrado" />
                  <Checklist ok label="Documento disponible" />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-park-border pt-4">
                <StatusBadge value={reservation.stay ? "CHECKED_IN" : reservation.status} />
                <Button disabled={!ready || !canCreate} onClick={() => doCheckIn(reservation.id)} type="button">
                  {reservation.stay ? "Check-in realizado" : "Realizar check-in"}
                </Button>
              </div>
            </article>
          );
        })}
        {!visibleRows.length ? <p className="rounded-card border border-park-border bg-white p-6 text-center text-park-muted shadow-card">No hay reservas para este filtro.</p> : null}
      </section>
    </div>
  );
}

function CompactMetric({ icon: Icon, label, value, tone = "green" }) {
  const toneClass = tone === "gold" ? "bg-park-gold-soft text-park-gold" : "bg-park-green-soft text-park-green";
  return (
    <article className="rounded-card border border-park-border bg-white p-4 shadow-card">
      <div className="flex items-center gap-3">
        <span className={`grid h-11 w-11 place-items-center rounded-card ${toneClass}`}><Icon size={20} /></span>
        <div>
          <p className="text-sm font-semibold text-park-muted">{label}</p>
          <strong className="font-display text-2xl font-semibold text-park-dark">{value}</strong>
        </div>
      </div>
    </article>
  );
}

function Info({ label, value }) {
  return <p><span className="inline-block w-20 text-park-muted">{label}</span><strong className="font-semibold text-park-black">{value}</strong></p>;
}

function Checklist({ ok, label }) {
  return <p className={ok ? "text-park-green" : "text-park-gold"}>{ok ? "OK" : "!"} {label}</p>;
}

function isToday(value) {
  const dateValue = new Date(value);
  const now = new Date();
  return dateValue.getFullYear() === now.getFullYear() && dateValue.getMonth() === now.getMonth() && dateValue.getDate() === now.getDate();
}

function date(value) {
  return new Date(value).toLocaleDateString("es-PE");
}

function time(value) {
  return new Date(value).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
}

function nights(reservation) {
  const start = new Date(reservation.checkInDate);
  const end = new Date(reservation.checkOutDate);
  return Math.max(1, Math.round((end - start) / 86400000));
}
