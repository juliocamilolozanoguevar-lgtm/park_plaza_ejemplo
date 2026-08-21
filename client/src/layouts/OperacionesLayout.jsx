import { Navigate, Outlet, useLocation } from "react-router-dom";
import { OperationsModuleNav } from "../components/ui/OperationsModuleNav";
import { permissionForHref } from "../constants/menu";
import { useAuth } from "../context/AuthContext";

// Primer módulo con permiso al que redirigir cuando el usuario llega a /operaciones
const FALLBACK_ORDER = [
  "/admin/restaurante/resumen",
  "/admin/bartender/resumen",
  "/inventario",
  "/admin/limpieza/resumen",
  "/admin/mantenimiento/resumen",
];

export function OperacionesLayout() {
  const { hasPermission } = useAuth();
  const { pathname } = useLocation();

  // Si el usuario aterriza exactamente en /operaciones, redirigir al primer módulo permitido
  if (pathname === "/operaciones") {
    const target = FALLBACK_ORDER.find((href) =>
      hasPermission(permissionForHref(href))
    );
    return target ? <Navigate to={target} replace /> : <Navigate to="/403" replace />;
  }

  return (
    <>
      <OperationsModuleNav />
      <Outlet />
    </>
  );
}
