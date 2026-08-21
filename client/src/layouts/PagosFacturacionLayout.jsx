import { Navigate, Outlet, useLocation } from "react-router-dom";
import { PagosFacturacionNav } from "../components/ui/FinanzasModuleNav";
import { permissionForHref } from "../constants/menu";
import { useAuth } from "../context/AuthContext";

const FALLBACK_ORDER = ["/pagos", "/facturacion"];

export function PagosFacturacionLayout() {
  const { hasPermission } = useAuth();
  const { pathname } = useLocation();

  if (pathname === "/pagos-facturacion") {
    const target = FALLBACK_ORDER.find((href) => hasPermission(permissionForHref(href)));
    return target ? <Navigate to={target} replace /> : <Navigate to="/403" replace />;
  }

  return (
    <>
      <PagosFacturacionNav />
      <Outlet />
    </>
  );
}
