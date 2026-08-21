import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./layouts/AppLayout";
import { OperacionesLayout } from "./layouts/OperacionesLayout";
import { AdministracionLayout } from "./layouts/AdministracionLayout";
import { ReservasClientesLayout } from "./layouts/ReservasClientesLayout";
import { EstadiasLayout } from "./layouts/EstadiasLayout";
import { ServiciosLayout } from "./layouts/ServiciosLayout";
import { PagosFacturacionLayout } from "./layouts/PagosFacturacionLayout";
import { CajaReportesLayout } from "./layouts/CajaReportesLayout";
import { useAuth } from "./context/AuthContext";
import { Login } from "./pages/Login";
import { Forbidden } from "./pages/Forbidden";
import { Dashboard } from "./modules/dashboard/Dashboard";
import { ClientsPage } from "./modules/clients/ClientsPage";
import { RoomsPage } from "./modules/rooms/RoomsPage";
import { ReservationsPage } from "./modules/reservations/ReservationsPage";
import { ReceptionPage } from "./modules/reception/ReceptionPage";
import { CheckInPage } from "./modules/reception/CheckInPage";
import { CheckOutPage } from "./modules/reception/CheckOutPage";
import { OrdersAreaPage } from "./modules/employees/OrdersAreaPage";
import { ProductionPage } from "./modules/employees/ProductionPage";
import { SuppliesPage } from "./modules/employees/SuppliesPage";
import { PoolPage } from "./modules/employees/PoolPage";
import { CleaningPage } from "./modules/employees/CleaningPage";
import { MaintenancePage } from "./modules/employees/MaintenancePage";
import { EventsPage } from "./modules/events/EventsPage";
import { InventoryPage } from "./modules/inventory/InventoryPage";
import { ReportsPage } from "./modules/reports/ReportsPage";
import { AdminResourcePage } from "./modules/admin/AdminResourcePage";
import { UsersPage } from "./modules/admin/UsersPage";
import { RolesPage } from "./modules/admin/RolesPage";
import { AdminCleaningPage } from "./modules/admin/AdminCleaningPage";
import { AdminBartenderPage } from "./modules/admin/AdminBartenderPage";
import { AdminRestaurantPage } from "./modules/admin/AdminRestaurantPage";
import { AdminMaintenancePage } from "./modules/admin/AdminMaintenancePage";
import { AttendancePage } from "./modules/attendance/AttendancePage";
import { AttendanceTerminal } from "./modules/attendance/AttendanceTerminal";
import { LoadingSpinner } from "./components/LoadingSpinner";
import { defaultRouteByRole, menuByRole, permissionForHref } from "./constants/menu";

const protectedRoutes = [
  ["/dashboard", "DASHBOARD:VER", <Dashboard />],
  // /clientes, /habitaciones, /reservas → manejadas por ReservasClientesLayout / EstadiasLayout
  // /checkin, /checkout → manejadas por EstadiasLayout
  ["/recepcion", "RECEPCION:VER", <ReceptionPage />],
  // /operaciones ahora lo maneja OperacionesLayout como ruta anidada en App()
  ["/consumos", "PEDIDOS:VER", <AdminResourcePage type="consumos" />],
  ["/restaurante/pedidos", "RESTAURANTE:VER", <OrdersAreaPage area="RESTAURANTE" />],
  ["/restaurante/cocina", "RESTAURANTE:VER", <OrdersAreaPage area="RESTAURANTE" />],
  ["/restaurante/preparacion", "RESTAURANTE:VER", <OrdersAreaPage area="RESTAURANTE" />],
  ["/restaurante/listos", "RESTAURANTE:VER", <OrdersAreaPage area="RESTAURANTE" />],
  ["/restaurante/entregados", "RESTAURANTE:VER", <OrdersAreaPage area="RESTAURANTE" />],
  ["/restaurante/historial", "RESTAURANTE:VER", <OrdersAreaPage area="RESTAURANTE" />],
  ["/restaurante/produccion", "RESTAURANTE:VER", <ProductionPage area="RESTAURANTE" />],
  ["/restaurante/insumos", "RESTAURANTE:VER", <SuppliesPage area="RESTAURANTE" />],
  // /admin/restaurante/* → manejadas por OperacionesLayout
  ["/bartender/pendientes", "BARTENDER:VER", <OrdersAreaPage area="BARTENDER" />],
  ["/bartender/preparando", "BARTENDER:VER", <OrdersAreaPage area="BARTENDER" />],
  ["/bartender/entregados", "BARTENDER:VER", <OrdersAreaPage area="BARTENDER" />],
  ["/bartender/historial", "BARTENDER:VER", <OrdersAreaPage area="BARTENDER" />],
  ["/bartender/insumos", "BARTENDER:VER", <SuppliesPage area="BARTENDER" />],
  // /admin/bartender/* → manejadas por OperacionesLayout
  ["/cochera", "COCHERA:VER", <AdminResourcePage type="cochera" />],
  // /piscina/*, /eventos/* → manejadas por ServiciosLayout
  ["/limpieza/pendientes", "LIMPIEZA:VER", <CleaningPage />],
  ["/limpieza/finalizadas", "LIMPIEZA:VER", <CleaningPage />],
  ["/limpieza/evidencias", "LIMPIEZA:VER", <CleaningPage />],
  ["/limpieza/reportes", "LIMPIEZA:VER", <CleaningPage />],
  // /admin/limpieza/* → manejadas por OperacionesLayout
  ["/mantenimiento/pendientes", "MANTENIMIENTO:VER", <MaintenancePage view="pendientes" />],
  ["/mantenimiento/reparacion", "MANTENIMIENTO:VER", <MaintenancePage view="reparacion" />],
  ["/mantenimiento/finalizados", "MANTENIMIENTO:VER", <MaintenancePage view="finalizados" />],
  ["/mantenimiento/evidencias", "MANTENIMIENTO:VER", <MaintenancePage view="evidencias" />],
  // /admin/mantenimiento/* → manejadas por OperacionesLayout
  // /inventario, /inventario/kardex → manejadas por OperacionesLayout
  // /compras y /proveedores → manejadas por AdministracionLayout
  // /pagos y /facturacion → manejadas por PagosFacturacionLayout
  // /caja y /reportes → manejadas por CajaReportesLayout
  ["/usuarios", "USUARIOS:VER", <UsersPage />],
  ["/roles", "ROLES:VER", <RolesPage />],
  ["/asistencia", "ASISTENCIA:VER", <AttendancePage view="resumen" />, ["ADMINISTRADOR"]],

  ["/asistencia/hoy", "ASISTENCIA:VER", <AttendancePage view="hoy" />, ["ADMINISTRADOR"]],
  ["/asistencia/historial", "ASISTENCIA:VER", <AttendancePage view="historial" />, ["ADMINISTRADOR"]],
  ["/auditoria", "AUDITORIA:VER", <AdminResourcePage type="auditoria" />],
  ["/configuracion", "CONFIGURACION:VER", <AdminResourcePage type="configuracion" />]
];

export function App() {
  const { loading } = useAuth();
  if (loading) return <LoadingSpinner />;

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/403" element={<Forbidden />} />
      <Route path="/asistencia/marcar" element={<AttendanceTerminal />} />
      <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route index element={<RoleRedirect />} />
        {protectedRoutes.map(([path, permission, element, roles]) => (
          <Route key={path} path={path} element={<RequirePermission permission={permission} roles={roles}>{element}</RequirePermission>} />
        ))}
        {/* ── Operaciones: layout con selector horizontal encima de cada módulo ── */}
        <Route element={<OperacionesLayout />}>
          <Route path="/operaciones" element={null} />
          {/* Restaurante admin */}
          <Route path="/admin/restaurante/resumen"         element={<RequirePermission permission="RESTAURANTE:VER"><AdminRestaurantPage view="resumen" /></RequirePermission>} />
          <Route path="/admin/restaurante/platos-y-recetas" element={<RequirePermission permission="RESTAURANTE:VER"><AdminRestaurantPage view="platos-y-recetas" /></RequirePermission>} />
          <Route path="/admin/restaurante/historial-consumo" element={<RequirePermission permission="RESTAURANTE:VER"><AdminRestaurantPage view="historial-consumo" /></RequirePermission>} />
          <Route path="/admin/restaurante/pedidos"          element={<RequirePermission permission="RESTAURANTE:VER"><AdminRestaurantPage view="pedidos" /></RequirePermission>} />
          <Route path="/admin/restaurante/gestion"          element={<RequirePermission permission="RESTAURANTE:VER"><AdminRestaurantPage view="gestion" /></RequirePermission>} />
          <Route path="/admin/restaurante/cocina"           element={<RequirePermission permission="RESTAURANTE:VER"><AdminRestaurantPage view="cocina" /></RequirePermission>} />
          <Route path="/admin/restaurante/preparando"       element={<RequirePermission permission="RESTAURANTE:VER"><AdminRestaurantPage view="preparando" /></RequirePermission>} />
          <Route path="/admin/restaurante/listos"           element={<RequirePermission permission="RESTAURANTE:VER"><AdminRestaurantPage view="listos" /></RequirePermission>} />
          <Route path="/admin/restaurante/entregados"       element={<RequirePermission permission="RESTAURANTE:VER"><AdminRestaurantPage view="entregados" /></RequirePermission>} />
          <Route path="/admin/restaurante/reportes"         element={<RequirePermission permission="RESTAURANTE:VER"><AdminRestaurantPage view="reportes" /></RequirePermission>} />
          <Route path="/admin/restaurante/incidencias"      element={<RequirePermission permission="RESTAURANTE:VER"><AdminRestaurantPage view="incidencias" /></RequirePermission>} />
          <Route path="/admin/restaurante/produccion"       element={<RequirePermission permission="RESTAURANTE:VER"><ProductionPage area="RESTAURANTE" admin /></RequirePermission>} />
          {/* Bartender admin */}
          <Route path="/admin/bartender/resumen"     element={<RequirePermission permission="BARTENDER:VER"><AdminBartenderPage view="resumen" /></RequirePermission>} />
          <Route path="/admin/bartender/pedidos"     element={<RequirePermission permission="BARTENDER:VER"><AdminBartenderPage view="pedidos" /></RequirePermission>} />
          <Route path="/admin/bartender/gestion"     element={<RequirePermission permission="BARTENDER:VER"><AdminBartenderPage view="gestion" /></RequirePermission>} />
          <Route path="/admin/bartender/historial"   element={<RequirePermission permission="BARTENDER:VER"><AdminBartenderPage view="historial" /></RequirePermission>} />
          <Route path="/admin/bartender/reportes"    element={<RequirePermission permission="BARTENDER:VER"><AdminBartenderPage view="reportes" /></RequirePermission>} />
          <Route path="/admin/bartender/incidencias" element={<RequirePermission permission="BARTENDER:VER"><AdminBartenderPage view="incidencias" /></RequirePermission>} />
          {/* Inventario */}
          <Route path="/inventario"        element={<RequirePermission permission="INVENTARIO:VER"><InventoryPage /></RequirePermission>} />
          <Route path="/inventario/kardex" element={<RequirePermission permission="INVENTARIO:VER"><InventoryPage /></RequirePermission>} />
          {/* Limpieza admin */}
          <Route path="/admin/limpieza/resumen"      element={<RequirePermission permission="LIMPIEZA:VER"><AdminCleaningPage view="resumen" /></RequirePermission>} />
          <Route path="/admin/limpieza/pendientes"   element={<RequirePermission permission="LIMPIEZA:VER"><AdminCleaningPage view="pendientes" /></RequirePermission>} />
          <Route path="/admin/limpieza/pisos"        element={<RequirePermission permission="LIMPIEZA:VER"><AdminCleaningPage view="pisos" /></RequirePermission>} />
          <Route path="/admin/limpieza/finalizadas"  element={<RequirePermission permission="LIMPIEZA:VER"><AdminCleaningPage view="finalizadas" /></RequirePermission>} />
          <Route path="/admin/limpieza/evidencias"   element={<RequirePermission permission="LIMPIEZA:VER"><AdminCleaningPage view="evidencias" /></RequirePermission>} />
          <Route path="/admin/limpieza/incidencias"  element={<RequirePermission permission="LIMPIEZA:VER"><AdminCleaningPage view="incidencias" /></RequirePermission>} />
          {/* Mantenimiento admin */}
          <Route path="/admin/mantenimiento/resumen"      element={<RequirePermission permission="REPORTES:VER" roles={["ADMINISTRADOR"]}><AdminMaintenancePage view="resumen" /></RequirePermission>} />
          <Route path="/admin/mantenimiento/solicitudes"  element={<RequirePermission permission="REPORTES:VER" roles={["ADMINISTRADOR"]}><AdminMaintenancePage view="solicitudes" /></RequirePermission>} />
          <Route path="/admin/mantenimiento/reparacion"   element={<RequirePermission permission="REPORTES:VER" roles={["ADMINISTRADOR"]}><AdminMaintenancePage view="reparacion" /></RequirePermission>} />
          <Route path="/admin/mantenimiento/finalizados"  element={<RequirePermission permission="REPORTES:VER" roles={["ADMINISTRADOR"]}><AdminMaintenancePage view="finalizados" /></RequirePermission>} />
          <Route path="/admin/mantenimiento/evidencias"   element={<RequirePermission permission="REPORTES:VER" roles={["ADMINISTRADOR"]}><AdminMaintenancePage view="evidencias" /></RequirePermission>} />
        </Route>
        {/* ── Administración: layout con selector horizontal encima de cada módulo ── */}
        <Route element={<AdministracionLayout />}>
          <Route path="/administracion" element={null} />
          <Route path="/compras"     element={<RequirePermission permission="COMPRAS:VER"><AdminResourcePage type="compras" /></RequirePermission>} />
          <Route path="/proveedores" element={<RequirePermission permission="PROVEEDORES:VER"><AdminResourcePage type="proveedores" /></RequirePermission>} />
        </Route>
        {/* ── Hotel: Reservas y Clientes ── */}
        <Route element={<ReservasClientesLayout />}>
          <Route path="/reservas-clientes" element={null} />
          <Route path="/reservas" element={<RequirePermission permission="RESERVAS:VER"><ReservationsPage /></RequirePermission>} />
          <Route path="/clientes"  element={<RequirePermission permission="CLIENTES:VER"><ClientsPage /></RequirePermission>} />
        </Route>
        {/* ── Hotel: Estadías ── */}
        <Route element={<EstadiasLayout />}>
          <Route path="/estadias"     element={null} />
          <Route path="/habitaciones" element={<RequirePermission permission="HABITACIONES:VER"><RoomsPage /></RequirePermission>} />
          <Route path="/checkin"      element={<RequirePermission permission="CHECK_IN:VER"><CheckInPage /></RequirePermission>} />
          <Route path="/checkout"     element={<RequirePermission permission="CHECK_OUT:VER"><CheckOutPage /></RequirePermission>} />
        </Route>
        {/* ── Hotel: Servicios (Piscina + Eventos) ── */}
        <Route element={<ServiciosLayout />}>
          <Route path="/servicios"               element={null} />
          <Route path="/piscina/ingresos"         element={<RequirePermission permission="PISCINA:VER"><PoolPage /></RequirePermission>} />
          <Route path="/piscina/validar-qr"       element={<RequirePermission permission="PISCINA:VER"><PoolPage /></RequirePermission>} />
          <Route path="/piscina/clientes-activos" element={<RequirePermission permission="PISCINA:VER"><PoolPage /></RequirePermission>} />
          <Route path="/piscina/reportes"         element={<RequirePermission permission="PISCINA:VER"><PoolPage /></RequirePermission>} />
          <Route path="/eventos/calendario"       element={<RequirePermission permission="EVENTOS:VER"><EventsPage /></RequirePermission>} />
          <Route path="/eventos/reservas"         element={<RequirePermission permission="EVENTOS:VER"><EventsPage /></RequirePermission>} />
          <Route path="/eventos/terraza"          element={<RequirePermission permission="EVENTOS:VER"><EventsPage /></RequirePermission>} />
          <Route path="/eventos/mirador"          element={<RequirePermission permission="EVENTOS:VER"><EventsPage /></RequirePermission>} />
          <Route path="/eventos/contratos"        element={<RequirePermission permission="EVENTOS:VER"><AdminResourcePage type="contratos" /></RequirePermission>} />
          <Route path="/eventos/pagos"            element={<RequirePermission permission="PAGOS:VER"><AdminResourcePage type="pagosEventos" /></RequirePermission>} />
        </Route>
        {/* ── Finanzas: Pagos y Facturación ── */}
        <Route element={<PagosFacturacionLayout />}>
          <Route path="/pagos-facturacion" element={null} />
          <Route path="/pagos"       element={<RequirePermission permission="PAGOS:VER"><AdminResourcePage type="pagos" /></RequirePermission>} />
          <Route path="/facturacion" element={<RequirePermission permission="FACTURACION:VER"><AdminResourcePage type="facturacion" /></RequirePermission>} />
        </Route>
        {/* ── Finanzas: Caja y Reportes ── */}
        <Route element={<CajaReportesLayout />}>
          <Route path="/caja-reportes" element={null} />
          <Route path="/caja"     element={<RequirePermission permission="CAJA:VER"><AdminResourcePage type="caja" /></RequirePermission>} />
          <Route path="/reportes" element={<RequirePermission permission="REPORTES:VER" roles={["ADMINISTRADOR"]}><ReportsPage /></RequirePermission>} />
        </Route>
      </Route>
      <Route path="*" element={<RoleRedirect />} />
    </Routes>
  );
}

function RoleRedirect() {
  const { user, hasPermission } = useAuth();
  const preferred = defaultRouteByRole[user?.role];
  if (preferred && hasPermission(permissionForHref(preferred))) return <Navigate to={preferred} replace />;
  const fallback = (menuByRole[user?.role] || []).find((item) => hasPermission(permissionForHref(item[1])));
  return <Navigate to={fallback?.[1] || "/403"} replace />;
}

function RequireAuth({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function RequirePermission({ permission, roles, children }) {
  const { hasPermission, user } = useAuth();
  const roleAllowed = !roles?.length || roles.includes(user?.role);
  return roleAllowed && hasPermission(permission) ? children : <Forbidden />;
}

