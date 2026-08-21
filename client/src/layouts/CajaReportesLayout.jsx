import { Navigate, Outlet, useLocation } from "react-router-dom";
import { CajaReportesNav } from "../components/ui/FinanzasModuleNav";
import { permissionForHref } from "../constants/menu";
import { useAuth } from "../context/AuthContext";

const FALLBACK_ORDER = ["/caja", "/reportes"];

export function CajaReportesLayout() {
  const { hasPermission } = useAuth();
  const { pathname } = useLocation();

  if (pathname === "/caja-reportes") {
    const target = FALLBACK_ORDER.find((href) => hasPermission(permissionForHref(href)));
    return target ? <Navigate to={target} replace /> : <Navigate to="/403" replace />;
  }

  return (
    <>
      <CajaReportesNav />
      <Outlet />
    </>
  );
}
