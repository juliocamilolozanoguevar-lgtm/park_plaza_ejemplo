import {
  BarChart3,
  BedDouble,
  CalendarCheck,
  CalendarClock,
  Car,
  ChefHat,
  CheckCircle2,
  ClipboardCheck,
  Coffee,
  DollarSign,
  FileText,
  LayoutDashboard,
  LockKeyhole,
  Package,
  Receipt,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  UserCog,
  Users,
  Waves,
  Wine,
  Wrench
} from "lucide-react";

export const menuSectionsByRole = {
  ADMINISTRADOR: [
    {
      label: "Principal",
      items: [
        ["Dashboard", "/dashboard", LayoutDashboard],
        {
          label: "Hotel",
          href: "/recepcion",
          icon: BedDouble,
          children: [
            ["Recepcion",          "/recepcion",        ClipboardCheck],
            ["Reservas y clientes", "/reservas-clientes", CalendarCheck],
            ["Estadias",           "/estadias",          BedDouble],
            ["Cochera",            "/cochera",           Car],
            ["Servicios",          "/servicios",         Waves]
          ]
        },
        ["Operaciones", "/operaciones", ChefHat],
        ["Administracion", "/administracion", Package],
        {
          label: "Finanzas",
          href: "/pagos-facturacion",
          icon: DollarSign,
          children: [
            ["Pagos y facturacion", "/pagos-facturacion", DollarSign],
            ["Caja y reportes",     "/caja-reportes",     BarChart3]
          ]
        },
        {
          label: "Personal",
          href: "/usuarios",
          icon: UserCog,
          children: [
            ["Usuarios", "/usuarios", UserCog],
            ["Asistencia", "/asistencia", CalendarClock]
          ]
        },
        {
          label: "Sistema",
          href: "/roles",
          icon: Settings,
          children: [
            ["Roles y permisos", "/roles", LockKeyhole],
            ["Auditoria", "/auditoria", FileText],
            ["Configuracion", "/configuracion", Settings]
          ]
        }
      ]
    }
  ],
  RECEPCIONISTA: [
    {
      label: "Recepcion",
      items: [
        ["Inicio", "/recepcion", LayoutDashboard]
      ]
    },
    {
      label: "Operacion",
      items: [
        ["Clientes", "/clientes", Users],
        ["Reservas", "/reservas", CalendarCheck],
        ["Habitaciones", "/habitaciones", BedDouble],
        ["Check-in", "/checkin", ShieldCheck],
        ["Check-out", "/checkout", Receipt]
      ]
    },
    {
      label: "Servicios",
      items: [
        ["Consumos", "/consumos", Receipt],
        ["Cochera", "/cochera", Car],
        ["Eventos", "/eventos/calendario", Sparkles]
      ]
    },
    {
      label: "Caja",
      items: [
        ["Pagos", "/pagos", DollarSign],
        ["Facturacion", "/facturacion", FileText]
      ]
    }
  ],
  RESTAURANTE: [
    {
      label: "Restaurante",
      items: [
        ["Pedidos", "/restaurante/pedidos", ChefHat],
        ["Produccion", "/restaurante/produccion", Package],
        ["Historial", "/restaurante/historial", FileText]
      ]
    }
  ],
  BARTENDER: [
    {
      label: "Bartender",
      items: [
        ["Pedidos", "/bartender/pendientes", Wine],
        ["Insumos", "/bartender/insumos", Package],
        ["Historial", "/bartender/historial", FileText]
      ]
    }
  ],
  PISCINA: [
    {
      label: "Piscina",
      items: [
        ["Ingresos", "/piscina/ingresos", Waves],
        ["Validar QR", "/piscina/validar-qr", ShieldCheck],
        ["Clientes Activos", "/piscina/clientes-activos", Users],
        ["Reportes", "/piscina/reportes", FileText]
      ]
    }
  ],
  LIMPIEZA: [
    {
      label: "Limpieza",
      items: [
        ["Limpieza", "/limpieza/pendientes", ClipboardCheck]
      ]
    }
  ],
  MANTENIMIENTO: [
    {
      label: "Mantenimiento",
      items: [
        ["Mantenimiento", "/mantenimiento/pendientes", Wrench]
      ]
    }
  ]
};

function flattenItems(items) {
  return items.flatMap((item) => {
    if (Array.isArray(item)) return [item];
    return [[item.label, item.href, item.icon], ...(item.children || [])];
  });
}

export const menuByRole = Object.fromEntries(
  Object.entries(menuSectionsByRole).map(([role, sections]) => [role, sections.flatMap((section) => flattenItems(section.items))])
);

const internalRouteTitles = [
  ["/asistencia/hoy", "Asistencia - Hoy"],
  ["/asistencia/historial", "Asistencia - Historial"],
  ["/asistencia/marcar", "Terminal de Asistencia"],
  ["/admin/restaurante/pedidos", "Restaurante - Pedidos"],
  ["/admin/restaurante/gestion", "Restaurante - Gestion"],
  ["/admin/restaurante/cocina", "Restaurante - Cocina"],
  ["/admin/restaurante/preparando", "Restaurante - Preparando"],
  ["/admin/restaurante/listos", "Restaurante - Listos"],
  ["/admin/restaurante/entregados", "Restaurante - Entregados"],
  ["/admin/restaurante/incidencias", "Restaurante - Incidencias"],
  ["/admin/restaurante/produccion", "Restaurante - Produccion"],
  ["/admin/restaurante/reportes", "Restaurante - Historial y reportes"],
  ["/admin/restaurante/platos-y-recetas", "Restaurante - Platos y recetas"],
  ["/admin/restaurante/historial-consumo", "Restaurante - Historial de consumo"],
  ["/admin/bartender/pedidos", "Bartender - Pedidos"],
  ["/admin/bartender/gestion", "Bartender - Gestion"],
  ["/admin/bartender/historial", "Bartender - Historial"],
  ["/admin/bartender/reportes", "Bartender - Historial y reportes"],
  ["/admin/bartender/incidencias", "Bartender - Incidencias"],
  ["/admin/limpieza/pendientes", "Limpieza - Pendientes"],
  ["/admin/limpieza/pisos", "Limpieza - Por piso"],
  ["/admin/limpieza/finalizadas", "Limpieza - Finalizadas"],
  ["/admin/limpieza/evidencias", "Limpieza - Evidencias"],
  ["/admin/limpieza/incidencias", "Limpieza - Incidencias"],
  ["/admin/mantenimiento/solicitudes", "Mantenimiento - Solicitudes"],
  ["/admin/mantenimiento/reparacion", "Mantenimiento - En reparacion"],
  ["/admin/mantenimiento/finalizados", "Mantenimiento - Finalizados"],
  ["/admin/mantenimiento/evidencias", "Mantenimiento - Evidencias"],
  ["/restaurante/cocina", "Restaurante - Cocina"],
  ["/restaurante/preparacion", "Restaurante - Preparacion"],
  ["/restaurante/listos", "Restaurante - Listos"],
  ["/restaurante/entregados", "Restaurante - Entregados"],
  ["/restaurante/historial", "Restaurante - Historial"],
  ["/restaurante/produccion", "Restaurante - Produccion"],
  ["/restaurante/insumos", "Restaurante - Insumos"],
  ["/bartender/preparando", "Bartender - Preparando"],
  ["/bartender/entregados", "Bartender - Entregados"],
  ["/bartender/historial", "Bartender - Historial"],
  ["/bartender/insumos", "Bartender - Insumos"],
  ["/limpieza/finalizadas", "Limpieza - Finalizadas"],
  ["/limpieza/evidencias", "Limpieza - Evidencias"],
  ["/mantenimiento/reparacion", "Mantenimiento - En reparacion"],
  ["/mantenimiento/finalizados", "Mantenimiento - Finalizados"],
  ["/mantenimiento/evidencias", "Mantenimiento - Evidencias"],
  ["/inventario/kardex", "Kardex de Inventario"]
];

export const routeTitles = Object.fromEntries(
  [...Object.values(menuSectionsByRole).flatMap((sections) => sections.flatMap((section) => flattenItems(section.items).map(([label, href]) => [href, label]))), ...internalRouteTitles]
);

export const defaultRouteByRole = {
  ADMINISTRADOR: "/dashboard",
  RECEPCIONISTA: "/recepcion",
  RESTAURANTE: "/restaurante/pedidos",
  BARTENDER: "/bartender/pendientes",
  PISCINA: "/piscina/ingresos",
  LIMPIEZA: "/limpieza/pendientes",
  MANTENIMIENTO: "/mantenimiento/pendientes"
};

export function permissionForHref(href) {
  if (!href) return null;
  if (href.startsWith("/admin/restaurante") || href.startsWith("/restaurante")) return "RESTAURANTE:VER";
  if (href.startsWith("/admin/bartender") || href.startsWith("/bartender")) return "BARTENDER:VER";
  if (href.startsWith("/admin/limpieza") || href.startsWith("/limpieza")) return "LIMPIEZA:VER";
  if (href.startsWith("/admin/mantenimiento") || href.startsWith("/mantenimiento")) return "MANTENIMIENTO:VER";
  if (href.startsWith("/asistencia")) return "ASISTENCIA:VER";
  if (href.startsWith("/piscina")) return "PISCINA:VER";
  if (href.startsWith("/eventos")) return "EVENTOS:VER";
  if (href.startsWith("/cochera")) return "COCHERA:VER";
  if (href.startsWith("/clientes")) return "CLIENTES:VER";
  if (href.startsWith("/habitaciones")) return "HABITACIONES:VER";
  if (href.startsWith("/reservas")) return "RESERVAS:VER";
  if (href.startsWith("/checkin")) return "CHECK_IN:VER";
  if (href.startsWith("/checkout")) return "CHECK_OUT:VER";
  if (href.startsWith("/recepcion")) return "RECEPCION:VER";
  if (href === "/operaciones") return null;
  if (href === "/administracion") return null;
  if (href === "/reservas-clientes") return null;
  if (href === "/estadias") return null;
  if (href === "/servicios") return null;
  if (href === "/pagos-facturacion") return null;
  if (href === "/caja-reportes") return null;
  if (href.startsWith("/consumos")) return "PEDIDOS:VER";
  if (href.startsWith("/inventario")) return "INVENTARIO:VER";
  if (href.startsWith("/compras")) return "COMPRAS:VER";
  if (href.startsWith("/proveedores")) return "PROVEEDORES:VER";
  if (href.startsWith("/pagos")) return "PAGOS:VER";
  if (href.startsWith("/facturacion")) return "FACTURACION:VER";
  if (href.startsWith("/caja")) return "CAJA:VER";
  if (href.startsWith("/usuarios")) return "USUARIOS:VER";
  if (href.startsWith("/roles")) return "ROLES:VER";
  if (href.startsWith("/reportes")) return "REPORTES:VER";
  if (href.startsWith("/auditoria")) return "AUDITORIA:VER";
  if (href.startsWith("/configuracion")) return "CONFIGURACION:VER";
  if (href.startsWith("/dashboard")) return "DASHBOARD:VER";
  return null;
}
