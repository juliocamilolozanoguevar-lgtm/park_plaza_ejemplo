import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Navbar } from "./Navbar";

export function AppLayout() {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-park-bg">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      {open ? <button className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setOpen(false)} type="button" aria-label="Cerrar menu" /> : null}
      <div className="lg:pl-72">
        <Navbar onMenu={() => setOpen(true)} />
        <main className="p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
