import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useFetch } from "../../hooks/useFetch";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { StatusBadge } from "../../components/StatusBadge";
import { Toast } from "../../components/Toast";
import { Button, PageHeader, Tabs } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";

const statuses = ["TODOS", "LIBRE", "RESERVADA", "OCUPADA", "EN_LIMPIEZA", "MANTENIMIENTO"];
const floorTabs = ["RESUMEN", "1", "2", "3", "4"];

export function RoomsPage() {
  const { can } = useAuth();
  const canCreateReservation = can("RESERVAS", "CREAR");
  const canViewReservation = can("RESERVAS", "VER");
  const canViewCheckout = can("CHECK_OUT", "VER");
  const canViewCleaning = can("LIMPIEZA", "VER");
  const { data, loading, error, reload } = useFetch("/rooms");
  const [floor, setFloor] = useState("RESUMEN");
  const [status, setStatus] = useState("TODOS");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState("");
  const allRooms = data?.rooms || [];
  const summary = useMemo(() => buildSummary(allRooms), [allRooms]);

  const rooms = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return allRooms.filter((room) => {
      const matchesFloor = floor === "RESUMEN" || String(room.floor) === floor;
      const matchesStatus = status === "TODOS" || room.status === status;
      const haystack = [room.number, room.floor, room.status, room.type?.name, room.capacity, room.price, roomContext(room)].filter(Boolean).join(" ").toLowerCase();
      const matchesSearch = !needle || haystack.includes(needle);
      return matchesFloor && matchesStatus && matchesSearch;
    });
  }, [allRooms, floor, status, search]);

  if (loading) return <LoadingSpinner />;
  if (error) return <p className="text-park-danger">{error.message}</p>;

  return (
    <div className="space-y-5">
      <Toast message={toast} onClose={() => setToast("")} />
      <PageHeader
        eyebrow="Alojamiento"
        title="Habitaciones"
        description="Disponibilidad y estado operativo por piso, conectado a reservas, estadias y limpieza."
        actions={<Button variant="secondary" onClick={reload}>Actualizar</Button>}
      />
      <Tabs tabs={floorTabs.map((item) => ({ value: item, label: item === "RESUMEN" ? "Resumen" : `Piso ${item}` }))} value={floor} onChange={(value) => { setFloor(value); setSearch(""); }} />

      {floor === "RESUMEN" ? (
        <RoomsSummary summary={summary} onFloor={(value) => setFloor(String(value))} />
      ) : (
        <>
          <section className="rounded-card border border-park-border bg-white p-4 shadow-card">
            <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-park-muted" size={17} />
                <input
                  className="h-10 w-full rounded-input border border-park-border bg-white px-3 pl-10 text-sm outline-none focus:border-park-green focus:ring-2 focus:ring-park-green/15"
                  placeholder={`Buscar habitacion, tipo o estado dentro del piso ${floor}`}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
              <Tabs tabs={statuses.map((item) => ({ value: item, label: item.replaceAll("_", " ") }))} value={status} onChange={setStatus} />
            </div>
          </section>
          <RoomsGrid rooms={rooms} canCreateReservation={canCreateReservation} canViewCheckout={canViewCheckout} canViewReservation={canViewReservation} canViewCleaning={canViewCleaning} />
        </>
      )}
    </div>
  );
}

function RoomsSummary({ summary, onFloor }) {
  return (
    <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Total" value={summary.total} />
        <Metric label="Disponibles" value={summary.status.LIBRE || 0} />
        <Metric label="Ocupadas" value={summary.status.OCUPADA || 0} />
        <Metric label="Limpieza" value={summary.status.EN_LIMPIEZA || 0} />
        <Metric label="Mantenimiento" value={summary.status.MANTENIMIENTO || 0} />
      </section>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((floor) => {
          const item = summary.floors[floor] || { total: 0, status: {} };
          return (
            <button className="rounded-card border border-park-border bg-white p-5 text-left shadow-card transition hover:-translate-y-0.5 hover:border-park-green focus:outline-none focus:ring-2 focus:ring-park-green/20" key={floor} type="button" onClick={() => onFloor(floor)}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase text-park-gold">Piso {floor}</p>
                  <strong className="font-display text-[30px] text-park-dark">{item.total}</strong>
                  <p className="text-sm text-park-muted">habitaciones</p>
                </div>
                <span className="rounded-full bg-park-green-soft px-3 py-1 text-xs font-black text-park-green">Ver piso</span>
              </div>
              <div className="mt-4 grid gap-2 text-sm">
                <Line label="Disponibles" value={item.status.LIBRE || 0} />
                <Line label="Ocupadas" value={item.status.OCUPADA || 0} />
                <Line label="Limpieza" value={item.status.EN_LIMPIEZA || 0} />
                <Line label="Mantenimiento" value={item.status.MANTENIMIENTO || 0} />
              </div>
            </button>
          );
        })}
      </section>
    </>
  );
}

function RoomsGrid({ rooms, canCreateReservation, canViewCheckout, canViewReservation, canViewCleaning }) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {rooms.map((room) => (
        <article className="rounded-card border border-park-border bg-white p-5 shadow-card" key={room.id}>
          <div className="flex items-start justify-between">
            <div>
              <strong className="font-display text-[28px] font-semibold text-park-dark">{room.number}</strong>
              <p className="text-sm text-park-muted">Piso {room.floor} - {room.type.name}</p>
            </div>
            <StatusBadge value={room.status} />
          </div>
          <div className="mt-4 grid gap-2 text-sm">
            <Line label="Capacidad" value={`${room.capacity} persona${room.capacity === 1 ? "" : "s"}`} />
            <Line label="Tarifa" value={`S/ ${Number(room.price).toFixed(2)}`} />
            <Line label="Contexto" value={roomContext(room)} />
          </div>
          <div className="mt-4">
            {room.status === "LIBRE" && canCreateReservation ? <Button as="a" href="/reservas" className="w-full" variant="secondary">Crear reserva</Button> : null}
            {room.status === "OCUPADA" && canViewCheckout ? <Button as="a" href="/checkout" className="w-full" variant="secondary">Ver estadia</Button> : null}
            {room.status === "RESERVADA" && canViewReservation ? <Button as="a" href="/reservas" className="w-full" variant="secondary">Ver reserva</Button> : null}
            {room.status === "EN_LIMPIEZA" && canViewCleaning ? <Button as="a" href="/limpieza/pendientes" className="w-full" variant="secondary">Ver limpieza</Button> : null}
            {["MANTENIMIENTO", "FUERA_SERVICIO"].includes(room.status) ? <span className="block rounded-card bg-park-danger-soft px-3 py-2 text-center text-sm font-semibold text-park-danger">No disponible</span> : null}
          </div>
        </article>
      ))}
    </section>
  );
}

function Metric({ label, value }) {
  return <article className="rounded-card border border-park-border bg-white p-5 shadow-card"><strong className="font-display text-[30px] text-park-dark">{value}</strong><p className="mt-1 text-xs font-black uppercase text-park-muted">{label}</p></article>;
}

function Line({ label, value }) {
  return <p className="flex justify-between gap-3"><span className="text-park-muted">{label}</span><strong className="text-right font-semibold text-park-black">{value}</strong></p>;
}

function buildSummary(rooms) {
  return rooms.reduce((acc, room) => {
    acc.total += 1;
    acc.status[room.status] = (acc.status[room.status] || 0) + 1;
    const floor = Number(room.floor);
    if (!acc.floors[floor]) acc.floors[floor] = { total: 0, status: {} };
    acc.floors[floor].total += 1;
    acc.floors[floor].status[room.status] = (acc.floors[floor].status[room.status] || 0) + 1;
    return acc;
  }, { total: 0, status: {}, floors: {} });
}

function roomContext(room) {
  const labels = {
    LIBRE: "Disponible para venta",
    RESERVADA: "Tiene reserva asociada",
    OCUPADA: "Estadia activa",
    EN_LIMPIEZA: "Pendiente de limpieza",
    MANTENIMIENTO: "Requiere revision",
    FUERA_SERVICIO: "Fuera de operacion"
  };
  return labels[room.status] || "-";
}
