import { Navigate, Outlet, useLocation } from "react-router-dom";
import { EstadiasNav } from "../components/ui/HotelModuleNav";
import { permissionForHref } from "../constants/menu";
import { useAuth } from "../context/AuthContext";

const FALLBACK_ORDER = ["/habitaciones", "/checkin", "/checkout"];

export function EstadiasLayout() {
  const { hasPermission } = useAuth();
  const { pathname } = useLocation();

  if (pathname === "/estadias") {
    const target = FALLBACK_ORDER.find((href) => hasPermission(permissionForHref(href)));
    return target ? <Navigate to={target} replace /> : <Navigate to="/403" replace />;
  }

  return (
    <>
      <EstadiasNav />
      <Outlet />
    </>
  );
}
