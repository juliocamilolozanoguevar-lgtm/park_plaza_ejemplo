import { NavLink } from "react-router-dom";

export function ModuleNav({ items }) {
  return (
    <div className="flex flex-wrap gap-2 rounded-card border border-park-border bg-white p-2 shadow-card">
      {items.map((item) => (
        <NavLink
          className={({ isActive }) => `rounded-button px-4 py-2 text-sm font-black transition ${isActive ? "bg-park-green text-white shadow-sm" : "text-park-muted hover:bg-park-light hover:text-park-green"}`}
          key={item.href}
          to={item.href}
        >
          {item.label}
        </NavLink>
      ))}
    </div>
  );
}