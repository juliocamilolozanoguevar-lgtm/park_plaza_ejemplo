import { Navigate, Outlet, useLocation } from "react-router-dom";
import { ServiciosModuleNav } from "../components/ui/ServiciosModuleNav";
import { permissionForHref } from "../constants/menu";
import { useAuth } from "../context/AuthContext";

const FALLBACK_ORDER = ["/piscina/ingresos", "/eventos/calendario"];

export function ServiciosLayout() {
  const { hasPermission } = useAuth();
  const { pathname } = useLocation();

  if (pathname === "/servicios") {
    const target = FALLBACK_ORDER.find((href) => hasPermission(permissionForHref(href)));
    return target ? <Navigate to={target} replace /> : <Navigate to="/403" replace />;
  }

  return (
    <>
      <ServiciosModuleNav />
      <Outlet />
    </>
  );
}
