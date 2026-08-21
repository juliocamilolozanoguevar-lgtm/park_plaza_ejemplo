import { ChefHat, ClipboardCheck, Package, Wine, Wrench } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { permissionForHref } from "../../constants/menu";
import { useAuth } from "../../context/AuthContext";

const MODULES = [
  { label: "Restaurante", href: "/admin/restaurante/resumen", icon: ChefHat },
  { label: "Bartender",   href: "/admin/bartender/resumen",  icon: Wine },
  { label: "Inventario",  href: "/inventario",               icon: Package },
  { label: "Limpieza",    href: "/admin/limpieza/resumen",   icon: ClipboardCheck },
  { label: "Mantenimiento", href: "/admin/mantenimiento/resumen", icon: Wrench },
];

// Prefijos que identifican a cada módulo para resaltar la pestaña correcta
// aunque la ruta interna cambie (ej. /admin/restaurante/platos-y-recetas)
const MODULE_PREFIXES = [
  { prefix: "/admin/restaurante", moduleHref: "/admin/restaurante/resumen" },
  { prefix: "/admin/bartender",   moduleHref: "/admin/bartender/resumen" },
  { prefix: "/inventario",        moduleHref: "/inventario" },
  { prefix: "/admin/limpieza",    moduleHref: "/admin/limpieza/resumen" },
  { prefix: "/admin/mantenimiento", moduleHref: "/admin/mantenimiento/resumen" },
];

function getActiveModuleHref(pathname) {
  const match = MODULE_PREFIXES.find(({ prefix }) =>
    pathname === prefix || pathname.startsWith(prefix + "/")
  );
  return match?.moduleHref ?? null;
}

export function OperationsModuleNav() {
  const { hasPermission } = useAuth();
  const { pathname } = useLocation();
  const activeModuleHref = getActiveModuleHref(pathname);

  const visibleModules = MODULES.filter((m) =>
    hasPermission(permissionForHref(m.href))
  );

  if (visibleModules.length === 0) return null;

  return (
    <div className="mb-5 overflow-x-auto">
      <div className="flex min-w-max gap-1 rounded-card border border-park-border bg-white p-1.5 shadow-card">
        {visibleModules.map(({ label, href, icon: Icon }) => {
          const isActive = activeModuleHref === href;
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
