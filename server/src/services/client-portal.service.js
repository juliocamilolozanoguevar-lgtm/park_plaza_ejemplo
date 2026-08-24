import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { HttpError, notFound } from "../utils/httpError.js";

function generateOrderCode() {
  const year = new Date().getFullYear();
  return `PED-${year}-${randomUUID().slice(0, 6).toUpperCase()}`;
}

function formatClientDTO(client) {
  if (!client) return null;
  return {
    id: client.id,
    firstName: client.firstName,
    lastName: client.lastName,
    documentNumber: client.documentNumber
  };
}

function formatRoomDTO(room) {
  if (!room) return null;
  return {
    id: room.id,
    number: room.number,
    type: room.type ? { id: room.type.id, name: room.type.name } : undefined
  };
}

function noteLine(notes, prefix) {
  return String(notes || "").split("\n").find((line) => line.startsWith(prefix))?.slice(prefix.length).trim() || null;
}

function formatOrderDTO(order) {
  const room = order.room || order.stay?.room || null;
  const client = order.client || order.stay?.client || null;
  return {
    id: order.id,
    code: order.code,
    area: order.area,
    status: order.status,
    total: Number(order.total),
    notes: order.notes,
    destinationLabel: order.destinationLabel || noteLine(order.notes, "Destino:"),
    roomId: order.roomId || order.stay?.roomId || room?.id || null,
    stayId: order.stayId || null,
    room: formatRoomDTO(room),
    client: formatClientDTO(client),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    items: order.items.map(item => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      price: Number(item.price)
    }))
  };
}

async function hydrateOrderContext(orders, db = prisma) {
  const list = Array.isArray(orders) ? orders : [orders];
  const clientIds = [...new Set(list.map((order) => order.clientId).filter(Boolean))];
  const roomIds = [...new Set(list.map((order) => order.roomId).filter(Boolean))];
  const [clients, rooms] = await Promise.all([
    clientIds.length ? db.client.findMany({ where: { id: { in: clientIds } } }) : [],
    roomIds.length ? db.room.findMany({ where: { id: { in: roomIds } }, include: { type: true } }) : []
  ]);
  const clientMap = new Map(clients.map((client) => [client.id, client]));
  const roomMap = new Map(rooms.map((room) => [room.id, room]));
  const hydrated = list.map((order) => ({
    ...order,
    client: order.stay?.client || clientMap.get(order.clientId) || null,
    room: order.stay?.room || roomMap.get(order.roomId) || null
  }));
  return Array.isArray(orders) ? hydrated : hydrated[0];
}

function buildOrderNotes(notes, contextLines) {
  return [...contextLines, notes?.trim() ? `Indicaciones: ${notes.trim()}` : null].filter(Boolean).join("\n") || null;
}

const SALES_NAMES = [
  { keys: ["ACEITE"], name: "Lomo saltado de la casa", category: "Fondos - Cocina" },
  { keys: ["ARROZ"], name: "Arroz chaufa amazónico", category: "Fondos - Cocina" },
  { keys: ["AZUCAR"], name: "Refresco natural de camu camu", category: "Bebidas - Cocina" },
  { keys: ["FIDEOS", "TALLARIN"], name: "Tallarines saltados", category: "Fondos - Cocina" },
  { keys: ["LECHUGA"], name: "Ensalada fresca Park Plaza", category: "Entradas - Cocina" },
  { keys: ["PIMIENTA"], name: "Pollo grillado con guarnición", category: "Fondos - Cocina" },
  { keys: ["PESCADO"], name: "Ceviche regional", category: "Entradas - Cocina" },
  { keys: ["LIMON"], name: "Limonada frozen", category: "Bebidas - Bar" },
  { keys: ["PISCO"], name: "Pisco sour clásico", category: "Cocteles - Bar" },
  { keys: ["GINEBRA", "GIN"], name: "Gin tonic amazónico", category: "Cocteles - Bar" }
];

function salesPresentation(product) {
  const text = String(`${product?.name || ""} ${product?.category?.name || ""}`).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  return SALES_NAMES.find((entry) => entry.keys.some((key) => text.includes(key))) || {
    name: product.name,
    category: product.category.name
  };
}

export async function loginClient(reservationCode, documentNumber) {
  if (!reservationCode || !documentNumber) {
    throw new HttpError(422, "El código de reserva y el número de documento son obligatorios.");
  }

  const reservation = await prisma.reservation.findFirst({
    where: { 
      code: reservationCode, 
      client: { documentNumber: String(documentNumber) } 
    },
    include: { client: true, stay: true }
  });

  if (!reservation) {
    throw new HttpError(401, "Credenciales incorrectas o reserva no encontrada.");
  }

  if (!reservation.stay || reservation.stay.status !== "ACTIVA") {
    throw new HttpError(403, "Solo los huéspedes con una estadía activa pueden acceder al portal.");
  }

  const payload = {
    role: "CLIENT",
    clientId: reservation.client.id,
    reservationId: reservation.id,
    stayId: reservation.stay.id,
    roomId: reservation.stay.roomId
  };

  const token = jwt.sign(payload, env.jwtSecret, { expiresIn: "7d" });

  return {
    token,
    client: {
      firstName: reservation.client.firstName,
      lastName: reservation.client.lastName,
    },
    stay: {
      id: reservation.stay.id,
      roomId: reservation.stay.roomId,
      checkInAt: reservation.stay.checkInAt
    }
  };
}

export async function getClientProfile(clientId, stayId) {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      stays: {
        where: { id: stayId },
        include: { room: { include: { type: true } }, reservation: true }
      }
    }
  });

  if (!client || client.stays.length === 0) throw notFound("Perfil o estadía no encontrada.");

  const stay = client.stays[0];
  return {
    client: {
      id: client.id,
      firstName: client.firstName,
      lastName: client.lastName,
      documentNumber: client.documentNumber,
      email: client.email,
      phone: client.phone
    },
    stay: {
      id: stay.id,
      checkInAt: stay.checkInAt,
      room: stay.room.number,
      roomType: stay.room.type.name,
      reservationCode: stay.reservation.code
    }
  };
}

export async function getClientMenu(area) {
  const products = await prisma.product.findMany({
    where: {
      area: area,
      active: true,
      status: "ACTIVO"
    },
    include: {
      category: true
    },
    orderBy: [
      { category: { name: 'asc' } },
      { name: 'asc' }
    ]
  });

  return products.map(p => ({
    id: p.id,
    name: p.name,
    category: p.category.name,
    price: Number(p.price),
    description: p.unit,
    available: Number(p.stock) > 0
  }));
}

export async function createClientOrder(clientId, stayId, roomId, data) {
  const { area, items, notes } = data;

  if (!area || !["RESTAURANTE", "BARTENDER"].includes(area)) {
    throw new HttpError(422, "Área inválida para el pedido.");
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new HttpError(422, "El pedido debe contener al menos un producto.");
  }

  return await prisma.$transaction(async (tx) => {
    let total = 0;
    const orderItemsToCreate = [];
    let orderStayId = stayId ? Number(stayId) : null;
    let orderRoomId = roomId ? Number(roomId) : null;
    const contextLines = [];

    if (data?.reservationId) {
      const reservation = await tx.reservation.findFirst({
        where: {
          id: Number(data.reservationId),
          clientId: Number(clientId),
          status: { notIn: ["CANCELADA", "COMPLETADA", "NO_SHOW"] }
        },
        include: { room: { include: { type: true } }, stay: true }
      });
      if (!reservation) throw new HttpError(422, "La reserva seleccionada no está disponible para pedidos.");
      orderRoomId = reservation.roomId;
      orderStayId = reservation.stay?.id || orderStayId;
      contextLines.push(`Reserva: ${reservation.code}`);
      contextLines.push(`Destino: Habitación ${reservation.room?.number || reservation.roomId}`);
    }

    if (data?.serviceReservationId) {
      const serviceReservation = await tx.serviceReservation.findFirst({
        where: {
          id: Number(data.serviceReservationId),
          clientId: Number(clientId),
          status: { notIn: ["CANCELADA", "FINALIZADA"] }
        },
        include: {
          reservation: { include: { room: { include: { type: true } } } },
          stay: { include: { room: { include: { type: true } } } }
        }
      });
      if (!serviceReservation) throw new HttpError(422, "El servicio seleccionado no está disponible para pedidos.");
      orderRoomId = serviceReservation.stay?.roomId || serviceReservation.reservation?.roomId || orderRoomId;
      orderStayId = serviceReservation.stayId || orderStayId;
      contextLines.push(`Reserva: ${serviceReservation.code}`);
      contextLines.push(`Servicio: ${serviceReservation.serviceType}`);
      contextLines.push(`Destino: ${data.destinationLabel || serviceReservation.serviceType}`);
    }

    if (data?.eventId) {
      const event = await tx.event.findFirst({
        where: {
          id: Number(data.eventId),
          clientId: Number(clientId),
          status: { notIn: ["CANCELADO", "FINALIZADO"] }
        },
        include: { space: true }
      });
      if (!event) throw new HttpError(422, "El evento seleccionado no está disponible para pedidos.");
      contextLines.push(`Reserva: EVT-${event.id}`);
      contextLines.push(`Destino: Evento ${event.name}`);
      contextLines.push(`Ambiente: ${event.space?.name || "Por confirmar"}`);
    }

    if (!contextLines.some((line) => line.startsWith("Destino:")) && data?.destinationLabel) {
      contextLines.push(`Destino: ${data.destinationLabel}`);
    }

    for (const item of items) {
      if (!item.productId || !item.quantity || item.quantity <= 0) {
        throw new HttpError(422, "Producto o cantidad inválida.");
      }

      const product = await tx.product.findUnique({
        where: { id: item.productId },
        include: { category: true }
      });

      if (!product || product.area !== area || !product.active) {
        throw new HttpError(422, `El producto con ID ${item.productId} no está disponible en esta área.`);
      }

      const lineTotal = Number(product.price) * item.quantity;
      total += lineTotal;

      orderItemsToCreate.push({
        productId: product.id,
        name: salesPresentation(product).name,
        category: salesPresentation(product).category,
        price: product.price,
        quantity: item.quantity
      });
    }

    const order = await tx.order.create({
      data: {
        code: generateOrderCode(),
        area: area,
        clientId: clientId,
        roomId: orderRoomId,
        stayId: orderStayId,
        status: "PENDIENTE",
        total: total,
        notes: buildOrderNotes(notes, contextLines),
        items: {
          create: orderItemsToCreate
        }
      },
      include: {
        items: true,
        stay: { include: { client: true, room: { include: { type: true } } } }
      }
    });

    return formatOrderDTO(await hydrateOrderContext(order, tx));
  });
}

export async function createCustomerOrder(clientId, data) {
  const clientIdNumber = Number(clientId);
  const [reservation, serviceReservation, event] = await Promise.all([
    prisma.reservation.findFirst({
      where: {
        clientId: clientIdNumber,
        status: { notIn: ["CANCELADA", "COMPLETADA", "NO_SHOW"] }
      },
      orderBy: { updatedAt: 'desc' }
    }),
    prisma.serviceReservation.findFirst({
      where: {
        clientId: clientIdNumber,
        status: { notIn: ["CANCELADA", "FINALIZADA"] }
      },
      orderBy: { updatedAt: 'desc' }
    }),
    prisma.event.findFirst({
      where: {
        clientId: clientIdNumber,
        status: { notIn: ["CANCELADO", "FINALIZADO"] }
      },
      orderBy: { startsAt: 'desc' }
    })
  ]);
  if (!reservation && !serviceReservation && !event) throw new HttpError(403, "Primero registra una reserva para poder realizar pedidos.");
  return createClientOrder(clientIdNumber, null, null, data);
}

export async function getClientOrders(stayId) {
  const orders = await prisma.order.findMany({
    where: { stayId },
    include: { items: true, stay: { include: { client: true, room: { include: { type: true } } } } },
    orderBy: { createdAt: 'desc' }
  });
  return (await hydrateOrderContext(orders)).map(formatOrderDTO);
}

export async function getCustomerOrders(clientId) {
  const orders = await prisma.order.findMany({
    where: { clientId: Number(clientId), stayId: null },
    include: { items: true, stay: { include: { client: true, room: { include: { type: true } } } } },
    orderBy: { createdAt: 'desc' }
  });
  return (await hydrateOrderContext(orders)).map(formatOrderDTO);
}

export async function getClientOrderById(clientId, stayId, orderId) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, stay: { include: { client: true, room: { include: { type: true } } } } }
  });

  if (!order) throw notFound("Pedido no encontrado.");
  if (order.stayId !== stayId) throw new HttpError(403, "No tienes permiso para ver este pedido.");

  return formatOrderDTO(await hydrateOrderContext(order));
}

export async function getClientConsumptions(stayId) {
  return await prisma.consumption.findMany({
    where: { stayId },
    select: {
      id: true,
      area: true,
      concept: true,
      amount: true,
      status: true,
      createdAt: true
    },
    orderBy: { createdAt: 'desc' }
  });
}

export async function getEventSpaces() {
  return await prisma.eventSpace.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      capacity: true,
      basePrice: true
    },
    orderBy: { name: 'asc' }
  });
}

function formatEventDTO(event) {
  return {
    id: event.id,
    name: event.name,
    type: event.type,
    espacio: event.space.name,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    guests: event.guests,
    status: event.status,
    price: Number(event.price),
    balance: Number(event.balance),
    notes: event.notes
  };
}

export async function getClientEvents(clientId) {
  const events = await prisma.event.findMany({
    where: { clientId },
    include: { space: true },
    orderBy: { startsAt: 'desc' }
  });
  return events.map(formatEventDTO);
}

export async function getClientEventById(clientId, eventId) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { space: true }
  });

  if (!event) throw notFound("Evento no encontrado.");
  if (event.clientId !== clientId) throw new HttpError(403, "No tienes permiso para ver este evento.");

  return formatEventDTO(event);
}

export async function requestEvent(clientId, data) {
  const { spaceId, name, type, startsAt, guests, notes } = data;

  if (!spaceId || !name || !type || !startsAt || !guests) {
    throw new HttpError(422, "Todos los campos del evento son requeridos.");
  }

  if (Number(guests) <= 0) {
    throw new HttpError(422, "La cantidad de invitados debe ser mayor a 0.");
  }

  const space = await prisma.eventSpace.findUnique({ where: { id: Number(spaceId) } });
  if (!space || !space.active) throw notFound("Espacio no disponible.");

  if (Number(guests) > space.capacity) {
    throw new HttpError(422, `La capacidad máxima del espacio es de ${space.capacity} invitados.`);
  }

  const startDate = new Date(startsAt);
  if (startDate < new Date()) {
    throw new HttpError(422, "La fecha del evento debe ser en el futuro.");
  }

  const endDate = new Date(startDate.getTime() + 4 * 60 * 60 * 1000); 

  const event = await prisma.event.create({
    data: {
      clientId: clientId,
      spaceId: space.id,
      name: name,
      type: type,
      startsAt: startDate,
      endsAt: endDate,
      guests: Number(guests),
      price: 0,
      balance: 0,
      status: "COTIZACION",
      notes: notes || "Solicitado desde portal cliente."
    },
    include: { space: true }
  });

  return formatEventDTO(event);
}

export async function requestPoolAccess(clientId, stayId, data) {
  // El flujo actual no soporta estados "PENDIENTE" para la piscina.
  // Crear directamente una entrada ACTIVA vulnera el flujo real donde el personal debe validar o controlar aforo.
  throw new HttpError(501, "No implementado. El modelo actual de PoolEntry no soporta estado PENDIENTE o de SOLICITUD para que el cliente auto-gestione su acceso. (Pendiente estructural).");
}
