import { useEffect } from "react";
import { CalendarDays, LogOut, Menu, Search, UserCircle } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { routeTitles } from "../constants/menu";

export function Navbar({ onMenu }) {
  const location = useLocation();
  const { user, logout, refreshUser } = useAuth();
  const title = routeTitles[location.pathname] || "Modulo ERP";
  const today = new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" }).format(new Date());
  const userName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Usuario";
  const userRole = user?.role || "ERP";

  useEffect(() => {
    refreshUser?.();
  }, [location.pathname]);

  return (
    <header className="sticky top-0 z-30 flex min-h-[72px] flex-wrap items-center gap-3 border-b border-park-border bg-white/95 px-3 py-3 shadow-sm backdrop-blur sm:gap-4 sm:px-4 lg:flex-nowrap lg:px-6">
      <button className="grid h-10 w-10 place-items-center rounded-lg hover:bg-slate-100 lg:hidden" onClick={onMenu} type="button">
        <Menu size={22} />
      </button>
      <div className="min-w-0 flex-1">
        <h2 className="truncate font-sans text-xl font-black leading-tight text-park-black sm:text-2xl">{title}</h2>
        <p className="truncate text-sm font-medium text-park-muted">Hotel Park Plaza / Sistema ERP hotelero</p>
      </div>
      <div className="ml-auto hidden h-11 w-full max-w-sm items-center gap-2 rounded-input border border-park-border bg-white px-3 text-sm text-park-muted shadow-sm md:flex">
        <Search size={17} />
        Buscar en el sistema...
      </div>
      <div className="hidden h-11 items-center gap-2 rounded-input border border-park-border bg-white px-3 text-sm font-semibold text-park-dark shadow-sm lg:flex">
        <CalendarDays size={17} />
        {today}
      </div>
      <div className="hidden h-11 items-center gap-3 rounded-input border border-park-border bg-white px-3 shadow-sm md:flex">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-park-dark text-white">
          <UserCircle size={20} />
        </span>
        <span className="leading-tight">
          <span className="block text-sm font-black text-park-black">{userName}</span>
          <span className="block text-xs font-semibold text-park-muted">{userRole}</span>
        </span>
      </div>
      <button className="grid h-11 w-11 place-items-center rounded-input border border-red-100 bg-white text-park-danger shadow-sm hover:bg-red-50" onClick={logout} type="button" title="Cerrar sesion">
        <LogOut size={20} />
      </button>
    </header>
  );
}
