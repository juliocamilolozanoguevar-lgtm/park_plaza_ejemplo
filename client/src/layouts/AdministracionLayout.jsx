import { Navigate, Outlet, useLocation } from "react-router-dom";
import { AdminModuleNav } from "../components/ui/AdminModuleNav";
import { permissionForHref } from "../constants/menu";
import { useAuth } from "../context/AuthContext";

// Primer módulo con permiso al que redirigir cuando el usuario llega a /administracion
const FALLBACK_ORDER = [
  "/compras",
  "/proveedores",
];

export function AdministracionLayout() {
  const { hasPermission } = useAuth();
  const { pathname } = useLocation();

  // Si el usuario aterriza exactamente en /administracion, redirigir al primer módulo permitido
  if (pathname === "/administracion") {
    const target = FALLBACK_ORDER.find((href) =>
      hasPermission(permissionForHref(href))
    );
    return target ? <Navigate to={target} replace /> : <Navigate to="/403" replace />;
  }

  return (
    <>
      <AdminModuleNav />
      <Outlet />
    </>
  );
}
