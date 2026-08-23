import { NavLink } from "react-router-dom";

export function ModuleNav({ items }) {
  return (
    <div className="flex flex-wrap gap-4 border-b border-park-border mb-2">
      {items.map((item) => (
        <NavLink
          className={({ isActive }) => `px-2 py-3 text-sm font-black transition-colors border-b-2 ${isActive ? "border-[#1E6FD6] text-[#1E6FD6]" : "border-transparent text-park-muted hover:bg-slate-50 hover:text-park-dark"}`}
          key={item.href}
          to={item.href}
        >
          {item.label}
        </NavLink>
      ))}
    </div>
  );
}