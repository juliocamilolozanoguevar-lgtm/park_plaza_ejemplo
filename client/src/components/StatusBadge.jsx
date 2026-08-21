const styles = {
  LIBRE: "bg-park-green-soft text-park-green",
  OCUPADA: "bg-park-danger-soft text-park-danger",
  RESERVADA: "bg-park-gold-soft text-park-black",
  EN_LIMPIEZA: "bg-park-green-soft text-park-dark",
  MANTENIMIENTO: "bg-slate-100 text-slate-700",
  FUERA_SERVICIO: "bg-park-danger-soft text-park-danger",
  CONFIRMADA: "bg-park-green-soft text-park-green",
  PENDIENTE: "bg-park-gold-soft text-park-black",
  EN_COCINA: "bg-park-green-soft text-park-dark",
  PREPARANDO: "bg-park-green-soft text-park-dark",
  LISTO: "bg-park-green-soft text-park-green",
  ENTREGADO: "bg-park-green-soft text-park-green",
  CANCELADO: "bg-park-danger-soft text-park-danger",
  CANCELADA: "bg-park-danger-soft text-park-danger",
  FINALIZADA: "bg-park-green-soft text-park-green",
  FINALIZADO: "bg-park-green-soft text-park-green",
  RESERVADO: "bg-park-gold-soft text-park-black",
  CONFIRMADO: "bg-park-green-soft text-park-green",
  COTIZACION: "bg-park-gold-soft text-park-black",
  OK: "bg-park-green-soft text-park-green",
  STOCK_BAJO: "bg-park-gold-soft text-park-black",
  SIN_STOCK: "bg-park-danger-soft text-park-danger",
  ENTRADA: "bg-park-green-soft text-park-green",
  SALIDA: "bg-park-danger-soft text-park-danger",
  AJUSTE: "bg-park-green-soft text-park-dark",
  BAJA: "bg-slate-100 text-slate-700",
  MEDIA: "bg-park-green-soft text-park-dark",
  ALTA: "bg-park-gold-soft text-park-black",
  CRITICA: "bg-park-danger-soft text-park-danger",
  ABIERTO: "bg-park-danger-soft text-park-danger",
  EN_REVISION: "bg-park-gold-soft text-park-black",
  RESUELTO: "bg-park-green-soft text-park-green",
  CHECKED_IN: "bg-park-green-soft text-park-green",
  COMPLETADA: "bg-park-green-soft text-park-green",
  NO_SHOW: "bg-park-danger-soft text-park-danger",
  ACTIVO: "bg-park-green-soft text-park-green",
  SUSPENDIDO: "bg-park-gold-soft text-park-black",
  INACTIVO: "bg-slate-100 text-slate-700",
  HOSPEDADO: "bg-park-green-soft text-park-green"
};

export function StatusBadge({ value }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${styles[value] || "bg-slate-100 text-slate-700"}`}>
      {String(value || "").replaceAll("_", " ")}
    </span>
  );
}


