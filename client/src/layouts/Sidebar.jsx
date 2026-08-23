import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { menuSectionsByRole, permissionForHref } from "../constants/menu";
import { useAuth } from "../context/AuthContext";
import logoParkPlaza from "../assets/park-plaza-logo.png";

export function Sidebar({ open, onClose }) {
  const { user, hasPermission } = useAuth();
  const location = useLocation();
  const sections = filterSectionsByPermission(menuSectionsByRole[user?.role] || [], hasPermission);
  const activeGroup = findActiveGroup(sections, location.pathname);
  const [expanded, setExpanded] = useState(activeGroup);
  const sidebarRef = useRef(null);

  useEffect(() => {
    setExpanded(activeGroup);
  }, [activeGroup]);

  useEffect(() => {
    function handleOutsideClick(event) {
      if (!expanded || sidebarRef.current?.contains(event.target)) return;
      setExpanded(null);
    }

    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, [expanded]);

  return (
    <aside ref={sidebarRef} className={`${open ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-park-dark text-white transition-transform lg:translate-x-0`}>
      <div className="p-5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <img
            className="h-10 w-10 shrink-0 rounded-md border border-white/15 bg-black object-cover"
            src={logoParkPlaza}
            alt="Hotel Park Plaza"
          />
          <div>
            <h1 className="font-display text-lg font-semibold uppercase leading-none text-white tracking-wide">Park Plaza</h1>
            <p className="text-[10px] font-bold uppercase text-park-accent-soft tracking-widest mt-1">ERP Hotelero</p>
          </div>
        </div>
        <div className="mt-5 flex items-center justify-between rounded-lg bg-park-primary/50 px-3 py-2 border border-park-primary">
          <span className="text-sm font-medium text-white truncate max-w-[120px]">{user?.firstName} {user?.lastName}</span>
          <span className="text-[9px] font-bold uppercase text-park-accent-soft bg-park-accent/20 px-1.5 py-0.5 rounded">{user?.role}</span>
        </div>
      </div>

      <nav className="sidebar-scroll grid gap-6 overflow-y-auto px-4 py-5">
        {sections.map((section) => (
          <div key={section.label}>
            <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-widest text-park-accent-soft/60">{section.label}</p>
            <div className="grid gap-1">
              {section.items.map((item) => Array.isArray(item) ? (
                <SidebarLink item={item} key={item[1]} onClose={onClose} />
              ) : (
                <SidebarGroup
                  expanded={expanded === item.href}
                  item={item}
                  key={item.href}
                  onClose={onClose}
                  onToggle={() => setExpanded((state) => (state === item.href ? null : item.href))}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="mt-auto p-5 text-xs text-white/70">
        <strong className="block text-white">Hotel Park Plaza</strong>
        Sistema ERP v1.0.0
      </div>
    </aside>
  );
}

function SidebarLink({ item, onClose, child = false }) {
  const [label, href, Icon] = item;
  const location = useLocation();
  return (
    <NavLink
      to={href}
      onClick={onClose}
      className={({ isActive }) => {
        const active = isActive || isSidebarLinkActive(location.pathname, href);
        return `flex items-center gap-3 rounded-button px-3 py-2 text-sm transition-colors ${child ? "ml-4 py-1.5 text-[13px]" : "font-medium"} ${active ? "bg-park-accent/20 text-park-accent-soft border border-park-accent/30" : "text-white/70 hover:bg-white/5 hover:text-white"}`;
      }}
    >
      <Icon size={child ? 15 : 18} />
      {label}
    </NavLink>
  );
}


function SidebarGroup({ item, expanded, onToggle, onClose }) {
  const Icon = item.icon;
  const panelId = useId();
  return (
    <div>
      <button
        className={`flex w-full items-center gap-3 rounded-button px-3 py-2 text-left text-sm font-medium transition-colors ${expanded ? "bg-white/5 text-white" : "text-white/70 hover:bg-white/5 hover:text-white"}`}
        aria-controls={panelId}
        aria-expanded={expanded}
        onClick={onToggle}
        type="button"
      >
        <Icon size={18} />
        <span className="flex-1">{item.label}</span>
        <ChevronDown className={`transition ${expanded ? "rotate-180" : ""}`} size={16} />
      </button>
      {expanded ? (
        <div className="mt-1 grid gap-1 transition-all" id={panelId}>
          {item.children.map((child) => <SidebarLink child item={child} key={child[1]} onClose={onClose} />)}
        </div>
      ) : null}
    </div>
  );
}

function filterSectionsByPermission(sections, hasPermission) {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.map((item) => filterMenuItem(item, hasPermission)).filter(Boolean)
    }))
    .filter((section) => section.items.length > 0);
}

function filterMenuItem(item, hasPermission) {
  if (Array.isArray(item)) {
    const permission = permissionForHref(item[1]);
    return hasPermission(permission) ? item : null;
  }
  const children = (item.children || []).filter((child) => hasPermission(permissionForHref(child[1])));
  if (!children.length) return null;
  return { ...item, children };
}

function findActiveGroup(sections, pathname) {
  for (const section of sections) {
    for (const item of section.items) {
      if (!Array.isArray(item)) {
        if (isSidebarLinkActive(pathname, item.href)) return item.href;
        if (item.children?.some((child) => isSidebarLinkActive(pathname, child[1]))) {
          return item.href;
        }
      }
    }
  }
  return null;
}

function isSidebarLinkActive(pathname, href) {
  return (
    isActivePath(pathname, href) ||
    sharesMenuRoute(pathname, href) ||
    isOperacionesActive(pathname, href) ||
    isAdministracionActive(pathname, href) ||
    isReservasClientesActive(pathname, href) ||
    isEstadiasActive(pathname, href) ||
    isServiciosActive(pathname, href) ||
    isPagosFacturacionActive(pathname, href) ||
    isCajaReportesActive(pathname, href)
  );
}

function isActivePath(pathname, href) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function sharesMenuRoute(pathname, href) {
  const currentPermission = permissionForHref(pathname);
  const itemPermission = permissionForHref(href);
  if (currentPermission && currentPermission === itemPermission) return true;

  const currentAdminBase = adminModuleBase(pathname);
  const itemAdminBase = adminModuleBase(href);
  return Boolean(currentAdminBase && currentAdminBase === itemAdminBase);
}

function adminModuleBase(pathname) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "admin" || parts.length < 2) return "";
  return `/${parts[0]}/${parts[1]}`;
}

// Marca /operaciones como activo cuando el usuario está en cualquier módulo de Operaciones
const OPERACIONES_PREFIXES = [
  "/admin/restaurante",
  "/admin/bartender",
  "/admin/limpieza",
  "/admin/mantenimiento",
  "/inventario",
];

function isOperacionesActive(pathname, href) {
  if (href !== "/operaciones") return false;
  return OPERACIONES_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
  );
}

// Marca /administracion como activo cuando el usuario está en cualquier módulo de Administración
const ADMINISTRACION_PREFIXES = [
  "/compras",
  "/proveedores",
];

function isAdministracionActive(pathname, href) {
  if (href !== "/administracion") return false;
  return ADMINISTRACION_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
  );
}

// Marca /reservas-clientes como activo cuando el usuario está en Reservas o Clientes
const RESERVAS_CLIENTES_PREFIXES = ["/reservas", "/clientes"];
function isReservasClientesActive(pathname, href) {
  if (href !== "/reservas-clientes") return false;
  return RESERVAS_CLIENTES_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
  );
}

// Marca /estadias como activo cuando el usuario está en Habitaciones, Check-in o Check-out
const ESTADIAS_PREFIXES = ["/habitaciones", "/checkin", "/checkout"];
function isEstadiasActive(pathname, href) {
  if (href !== "/estadias") return false;
  return ESTADIAS_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
  );
}

// Marca /servicios como activo cuando el usuario está en Piscina o Eventos
const SERVICIOS_PREFIXES = ["/piscina", "/eventos"];
function isServiciosActive(pathname, href) {
  if (href !== "/servicios") return false;
  return SERVICIOS_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
  );
}

// Marca /pagos-facturacion como activo cuando el usuario está en /pagos o /facturacion
const PAGOS_FACTURACION_PREFIXES = ["/pagos", "/facturacion"];
function isPagosFacturacionActive(pathname, href) {
  if (href !== "/pagos-facturacion") return false;
  return PAGOS_FACTURACION_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
  );
}

// Marca /caja-reportes como activo cuando el usuario está en /caja o /reportes
const CAJA_REPORTES_PREFIXES = ["/caja", "/reportes"];
function isCajaReportesActive(pathname, href) {
  if (href !== "/caja-reportes") return false;
  return CAJA_REPORTES_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
  );
}
