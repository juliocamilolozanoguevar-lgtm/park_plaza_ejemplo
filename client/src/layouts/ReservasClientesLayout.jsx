import { Navigate, Outlet, useLocation } from "react-router-dom";
import { ReservasClientesNav } from "../components/ui/HotelModuleNav";
import { permissionForHref } from "../constants/menu";
import { useAuth } from "../context/AuthContext";

const FALLBACK_ORDER = ["/reservas", "/clientes"];

export function ReservasClientesLayout() {
  const { hasPermission } = useAuth();
  const { pathname } = useLocation();

  if (pathname === "/reservas-clientes") {
    const target = FALLBACK_ORDER.find((href) => hasPermission(permissionForHref(href)));
    return target ? <Navigate to={target} replace /> : <Navigate to="/403" replace />;
  }

  return (
    <>
      <ReservasClientesNav />
      <Outlet />
    </>
  );
}
