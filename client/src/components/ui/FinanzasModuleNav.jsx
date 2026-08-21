import { BarChart3, DollarSign, FileText } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { permissionForHref } from "../../constants/menu";
import { useAuth } from "../../context/AuthContext";

// ── Pagos y Facturación ──────────────────────────────────────
const MODULES_PAGOS = [
  { label: "Pagos",       href: "/pagos",       icon: DollarSign },
  { label: "Facturación", href: "/facturacion", icon: FileText   },
];

const PREFIXES_PAGOS = [
  { prefix: "/pagos",       moduleHref: "/pagos"       },
  { prefix: "/facturacion", moduleHref: "/facturacion" },
];

// ── Caja y Reportes ──────────────────────────────────────────
const MODULES_CAJA = [
  { label: "Caja General", href: "/caja",     icon: DollarSign },
  { label: "Reportes",     href: "/reportes", icon: BarChart3  },
];

const PREFIXES_CAJA = [
  { prefix: "/caja",     moduleHref: "/caja"     },
  { prefix: "/reportes", moduleHref: "/reportes" },
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

export function PagosFacturacionNav() {
  return <ModuleNavBar modules={MODULES_PAGOS} prefixes={PREFIXES_PAGOS} />;
}

export function CajaReportesNav() {
  return <ModuleNavBar modules={MODULES_CAJA} prefixes={PREFIXES_CAJA} />;
}
