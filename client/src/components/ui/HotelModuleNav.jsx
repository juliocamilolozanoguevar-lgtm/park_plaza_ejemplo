import { BedDouble, CalendarCheck, CheckCircle2, Receipt, ShieldCheck } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { permissionForHref } from "../../constants/menu";
import { useAuth } from "../../context/AuthContext";

// ── Reservas y Clientes ──────────────────────────────────────
const MODULES_RESERVAS = [
  { label: "Reservas",  href: "/reservas",  icon: CalendarCheck },
  { label: "Clientes",  href: "/clientes",  icon: CheckCircle2  },
];

const PREFIXES_RESERVAS = [
  { prefix: "/reservas", moduleHref: "/reservas" },
  { prefix: "/clientes", moduleHref: "/clientes" },
];

// ── Estadías ─────────────────────────────────────────────────
const MODULES_ESTADIAS = [
  { label: "Habitaciones", href: "/habitaciones", icon: BedDouble   },
  { label: "Check-in",     href: "/checkin",      icon: ShieldCheck },
  { label: "Check-out",    href: "/checkout",     icon: Receipt     },
];

const PREFIXES_ESTADIAS = [
  { prefix: "/habitaciones", moduleHref: "/habitaciones" },
  { prefix: "/checkin",      moduleHref: "/checkin"      },
  { prefix: "/checkout",     moduleHref: "/checkout"     },
];

function getActiveHref(pathname, prefixes) {
  const match = prefixes.find(({ prefix }) =>
    pathname === prefix || pathname.startsWith(prefix + "/")
  );
  return match?.moduleHref ?? null;
}

function ModuleNavBar({ modules, prefixes }) {
  const { hasPermission } = useAuth();
  const { pathname } = useLocation();
  const activeHref = getActiveHref(pathname, prefixes);

  const visible = modules.filter((m) => hasPermission(permissionForHref(m.href)));
  if (visible.length === 0) return null;

  return (
    <div className="mb-5 overflow-x-auto">
      <div className="flex min-w-max gap-1 rounded-card border border-park-border bg-white p-1.5 shadow-card">
        {visible.map(({ label, href, icon: Icon }) => {
          const isActive = activeHref === href;
          return (
            <NavLink
              key={href}
              to={href}
              className={`flex items-center gap-2 rounded-button px-3.5 py-2 text-sm font-semibold transition-all ${
                isActive
                  ? "bg-park-gold text-park-black shadow-sm"
                  : "text-park-muted hover:bg-park-green-soft hover:text-park-green"
              }`}
            >
              <Icon size={15} />
              <span>{label}</span>
            </NavLink>
          );
        })}
      </div>
    </div>
  );
}

export function ReservasClientesNav() {
  return <ModuleNavBar modules={MODULES_RESERVAS} prefixes={PREFIXES_RESERVAS} />;
}

export function EstadiasNav() {
  return <ModuleNavBar modules={MODULES_ESTADIAS} prefixes={PREFIXES_ESTADIAS} />;
}
