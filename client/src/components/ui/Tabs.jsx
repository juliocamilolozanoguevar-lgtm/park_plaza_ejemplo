export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="flex max-w-full overflow-x-auto gap-4 border-b border-park-border mb-4">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          className={`shrink-0 px-2 py-3 text-sm font-black transition-colors border-b-2 ${value === tab.value ? "border-[#1E6FD6] text-[#1E6FD6]" : "border-transparent text-park-muted hover:bg-slate-50 hover:text-park-dark"}`}
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
