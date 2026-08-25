export function AdminMetricStrip({ metrics }) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-card border border-park-border bg-white px-5 py-3 shadow-sm">
      {metrics.map((metric, index) => (
        <div key={index} className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-xs font-medium uppercase text-park-muted">{metric.label}</span>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-park-dark">{metric.value}</span>
              {metric.subtext && <span className="text-xs text-park-muted">{metric.subtext}</span>}
            </div>
          </div>
          {index < metrics.length - 1 && (
            <div className="h-8 w-px bg-park-border" />
          )}
        </div>
      ))}
    </div>
  );
}
