import { Link } from "react-router-dom";
import { BedDouble, CalendarCheck, CreditCard, Eye, LogIn, LogOut, Users } from "lucide-react";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { MetricCard } from "../../components/MetricCard";
import { StatusBadge } from "../../components/StatusBadge";
import { useFetch } from "../../hooks/useFetch";
import { Button, ModuleCard, PageHeader } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";

export function ReceptionPage() {
  const { can } = useAuth();
  const canCreateReservation = can("RESERVAS", "CREAR");
  const canViewClients = can("CLIENTES", "VER");
  const canViewCheckIn = can("CHECK_IN", "VER");
  const canViewCheckOut = can("CHECK_OUT", "VER");
  const canCreatePayment = can("PAGOS", "CREAR");
  const canViewDashboard = can("DASHBOARD", "VER");
  const { data, loading, error } = useFetch("/dashboard");
  const { data: reservations } = useFetch("/reservations", { initialData: [] });

  if (loading) return <LoadingSpinner />;
  if (error) return <p className="rounded-card bg-park-danger-soft p-4 font-semibold text-park-danger">{error.message}</p>;

  const metrics = data.metrics;
  const arrivals = (reservations || [])
    .filter((reservation) => isToday(reservation.checkInDate) && !reservation.stay)
    .slice(0, 5);
  const summary = [
    ["Reservas hoy", metrics.reservationsToday],
    ["Check-ins", metrics.checkInsToday],
    ["Check-outs", metrics.checkOutsToday],
    ["Habitaciones ocupadas", metrics.occupiedRooms],
    ["Habitaciones libres", metrics.availableRooms],
    ["Incidencias abiertas", metrics.incidentsOpen],
    ["Alta prioridad", metrics.incidentsHighPriority],
    ["Eventos proximos", data.upcomingEvents?.length || 0]
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Operacion diaria"
        title="Recepcion"
        description="Resumen operativo para gestionar llegadas, salidas, pagos pendientes y disponibilidad desde datos reales."
        actions={canCreateReservation ? <Button as={Link} to="/reservas" variant="gold">Nueva reserva</Button> : null}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Llegadas hoy" value={metrics.reservationsToday} hint="reservas con entrada hoy" icon={CalendarCheck} />
        <MetricCard label="Check-ins hoy" value={metrics.checkInsToday} hint="huespedes registrados" icon={LogIn} />
        <MetricCard label="Check-outs hoy" value={metrics.checkOutsToday} hint="salidas completadas" icon={LogOut} tone="gold" />
        <MetricCard label="Habitaciones libres" value={metrics.availableRooms} hint="disponibles para venta" icon={BedDouble} />
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {canViewClients ? <ModuleCard title="Buscar cliente" description="Consulta clientes por nombre, DNI o correo." href="/clientes" icon={Users} meta="Recepcion" /> : null}
        {canViewCheckIn ? <ModuleCard title="Check-in" description="Confirma llegada y crea la estadia." href="/checkin" icon={LogIn} meta="Flujo guiado" /> : null}
        {canViewCheckOut ? <ModuleCard title="Check-out" description="Revisa consumos, pagos y libera la habitacion a limpieza." href="/checkout" icon={LogOut} meta="Cierre" /> : null}
        {canCreatePayment ? <ModuleCard title="Registrar pago" description="Consulta movimientos y pagos operativos." href="/pagos" icon={CreditCard} meta="Caja" /> : null}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_280px]">
        <article className="rounded-card border border-park-border bg-white shadow-card">
          <div className="flex items-center justify-between border-b border-park-border px-5 py-4">
            <div>
              <h2 className="font-display text-lg font-semibold text-park-dark">Proximas llegadas</h2>
              <p className="text-sm text-park-muted">Reservas con entrada programada para hoy.</p>
            </div>
            {canViewCheckIn ? <Button as={Link} to="/checkin" size="sm" variant="secondary">Ver check-in</Button> : null}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-park-bg text-xs uppercase text-park-muted">
                <tr>
                  {["Hora", "Huesped", "Habitacion", "Entrada", "Noches", "Estado", "Accion"].map((column) => (
                    <th className="px-5 py-3 font-bold" key={column}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-park-border">
                {arrivals.length ? arrivals.map((reservation) => (
                  <tr key={reservation.id}>
                    <td className="px-5 py-3 font-semibold">{time(reservation.checkInDate)}</td>
                    <td className="px-5 py-3">
                      <span className="block font-semibold text-park-black">{reservation.client?.firstName} {reservation.client?.lastName}</span>
                      <span className="text-xs text-park-muted">DNI {reservation.client?.documentNumber}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="block font-semibold">{reservation.room?.number}</span>
                      <span className="text-xs text-park-muted">{reservation.room?.type?.name}</span>
                    </td>
                    <td className="px-5 py-3">{date(reservation.checkInDate)}</td>
                    <td className="px-5 py-3">{nights(reservation)}</td>
                    <td className="px-5 py-3"><StatusBadge value={reservation.status} /></td>
                    <td className="px-5 py-3">
                      {canViewCheckIn ? <Button as={Link} to={`/checkin?search=${encodeURIComponent(reservation.code)}`} size="sm" variant="secondary" icon={Eye}>Abrir</Button> : null}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td className="px-5 py-6 text-center text-park-muted" colSpan={7}>No hay llegadas pendientes para hoy.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="rounded-card border border-park-border bg-white p-5 shadow-card">
          <h2 className="font-display text-lg font-semibold text-park-dark">Resumen del dia</h2>
          <dl className="mt-4 divide-y divide-park-border">
            {summary.map(([label, value]) => (
              <div className="flex items-center justify-between py-2 text-sm" key={label}>
                <dt className="text-park-muted">{label}</dt>
                <dd className={`font-semibold ${Number(value) > 0 && ["Incidencias abiertas", "Alta prioridad"].includes(label) ? "text-park-danger" : "text-park-black"}`}>{value || 0}</dd>
              </div>
            ))}
          </dl>
          {canViewDashboard ? <Button as={Link} to="/dashboard" className="mt-4 w-full" variant="secondary">Ver reporte completo</Button> : null}
        </article>
      </section>
    </div>
  );
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
