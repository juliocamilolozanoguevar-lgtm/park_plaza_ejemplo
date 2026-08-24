import { prisma } from "../config/prisma.js";

function todayBounds() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

async function hydrateOrderContext(orders) {
  const clientIds = [...new Set(orders.map((order) => order.clientId).filter(Boolean))];
  const roomIds = [...new Set(orders.map((order) => order.roomId).filter(Boolean))];
  const [clients, rooms] = await Promise.all([
    clientIds.length ? prisma.client.findMany({ where: { id: { in: clientIds } } }) : [],
    roomIds.length ? prisma.room.findMany({ where: { id: { in: roomIds } }, include: { type: true } }) : []
  ]);
  const clientMap = new Map(clients.map((client) => [client.id, client]));
  const roomMap = new Map(rooms.map((room) => [room.id, room]));
  return orders.map((order) => ({
    ...order,
    client: order.stay?.client || clientMap.get(order.clientId) || null,
    room: order.stay?.room || roomMap.get(order.roomId) || null
  }));
}

export async function getDashboard() {
  const { start, end } = todayBounds();

  const [
    roomStatus,
    reservationsToday,
    noShow,
    checkInsToday,
    checkOutsToday,
    hostedGuests,
    paymentsToday,
    lowStock,
    upcomingEvents,
    recentActivity,
    orders,
    poolEntries,
    parking,
    cleaning,
    openIncidents,
    highPriorityIncidents
  ] = await Promise.all([
    prisma.room.groupBy({ by: ["status"], _count: true }),
    prisma.reservation.count({ where: { checkInDate: { gte: start, lt: end } } }),
    prisma.reservation.count({ where: { status: "NO_SHOW" } }),
    prisma.stay.count({ where: { checkInAt: { gte: start, lt: end } } }),
    prisma.stay.count({ where: { checkOutAt: { gte: start, lt: end } } }),
    prisma.stay.count({ where: { status: "ACTIVA" } }),
    prisma.payment.findMany({ where: { status: "REGISTRADO", paidAt: { gte: start, lt: end } } }),
    prisma.product.findMany({ where: { stock: { lte: prisma.product.fields.minStock } }, include: { category: true }, take: 8 }),
    prisma.event.findMany({ where: { startsAt: { gte: start } }, include: { client: true, space: true }, orderBy: { startsAt: "asc" }, take: 5 }),
    prisma.auditLog.findMany({ include: { user: true }, orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.order.findMany({ where: { status: { in: ["PENDIENTE", "EN_COCINA", "PREPARANDO", "LISTO"] } }, include: { items: true, stay: { include: { client: true, room: { include: { type: true } } } } }, take: 6, orderBy: { createdAt: "desc" } }),
    prisma.poolEntry.count({ where: { entryAt: { gte: start, lt: end } } }),
    prisma.parkingSpace.groupBy({ by: ["status"], _count: true }),
    prisma.cleaningTask.findMany({ where: { status: { in: ["PENDIENTE", "EN_LIMPIEZA"] } }, include: { room: { include: { type: true } } }, take: 6 }),
    prisma.operationalReport.count({ where: { status: "ABIERTO" } }),
    prisma.operationalReport.count({ where: { priority: { in: ["ALTA", "CRITICA"] }, status: { not: "RESUELTO" } } })
  ]);

  const rooms = roomStatus.reduce((acc, item) => {
    acc[item.status] = item._count;
    return acc;
  }, {});

  const incomeToday = paymentsToday.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const salesByArea = Object.values(paymentsToday.reduce((acc, payment) => {
    const area = payment.area;
    acc[area] = acc[area] || { area, total: 0 };
    acc[area].total += Number(payment.amount);
    return acc;
  }, {}));

  return {
    metrics: {
      occupiedRooms: rooms.OCUPADA || 0,
      availableRooms: rooms.LIBRE || 0,
      reservationsToday,
      noShow,
      checkInsToday,
      checkOutsToday,
      hostedGuests,
      incomeToday,
      incidentsOpen: openIncidents,
      incidentsHighPriority: highPriorityIncidents
    },
    charts: {
      income: paymentsToday.map((payment) => ({
        time: payment.paidAt.toISOString().slice(11, 16),
        amount: Number(payment.amount)
      })),
      salesByArea
    },
    lowStock,
    upcomingEvents,
    recentActivity,
    modules: {
      orders: await hydrateOrderContext(orders),
      poolEntries,
      parking,
      cleaning
    },
    alerts: lowStock.map((product) => ({
      type: "STOCK_BAJO",
      message: `${product.name} tiene stock bajo (${product.stock})`
    }))
  };
}
