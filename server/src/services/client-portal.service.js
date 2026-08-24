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
  // area can be "RESTAURANTE" or "BARTENDER"
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
    description: p.unit, // Or if you have a description field
    stock: Number(p.stock)
  }));
}

export async function createClientOrder(clientId, stayId, roomId, data) {
  const { area, items, notes } = data; // area = "RESTAURANTE" or "BARTENDER"

  if (!area || !["RESTAURANTE", "BARTENDER"].includes(area)) {
    throw new HttpError(422, "Área inválida para el pedido.");
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new HttpError(422, "El pedido debe contener al menos un producto.");
  }

  return await prisma.$transaction(async (tx) => {
    let total = 0;
    const orderItemsToCreate = [];

    for (const item of items) {
      if (!item.productId || !item.quantity || item.quantity <= 0) {
        throw new HttpError(422, "Producto o cantidad inválida.");
      }

      const product = await tx.product.findUnique({
        where: { id: item.productId }
      });

      if (!product || product.area !== area || !product.active) {
        throw new HttpError(422, `El producto con ID ${item.productId} no está disponible en esta área.`);
      }

      // Validar si es necesario que stock > 0, por ahora solo tomamos precio
      const lineTotal = Number(product.price) * item.quantity;
      total += lineTotal;

      orderItemsToCreate.push({
        productId: product.id,
        name: product.name,
        category: "Menu", // We could fetch category name but product doesn't include it unless queried
        price: product.price,
        quantity: item.quantity
      });
    }

    const order = await tx.order.create({
      data: {
        code: generateOrderCode(),
        area: area,
        clientId: clientId,
        roomId: roomId,
        stayId: stayId,
        status: "PENDIENTE",
        total: total,
        notes: notes || null,
        items: {
          create: orderItemsToCreate
        }
      },
      include: {
        items: true
      }
    });

    return order;
  });
}

export async function getClientOrders(stayId) {
  return await prisma.order.findMany({
    where: { stayId },
    include: {
      items: true
    },
    orderBy: { createdAt: 'desc' }
  });
}

export async function getClientConsumptions(stayId) {
  return await prisma.consumption.findMany({
    where: { stayId },
    orderBy: { createdAt: 'desc' }
  });
}

export async function getEventSpaces() {
  return await prisma.eventSpace.findMany({
    where: { active: true },
    orderBy: { name: 'asc' }
  });
}

export async function requestEvent(clientId, data) {
  const { spaceId, name, type, startsAt, guests, notes } = data;

  if (!spaceId || !name || !type || !startsAt || !guests) {
    throw new HttpError(422, "Todos los campos del evento son requeridos.");
  }

  const space = await prisma.eventSpace.findUnique({ where: { id: Number(spaceId) } });
  if (!space || !space.active) throw notFound("Espacio no disponible.");

  // For a generic request, duration is approx 4 hours
  const startDate = new Date(startsAt);
  const endDate = new Date(startDate.getTime() + 4 * 60 * 60 * 1000); 

  return await prisma.event.create({
    data: {
      clientId: clientId,
      spaceId: space.id,
      name: name,
      type: type,
      startsAt: startDate,
      endsAt: endDate,
      guests: Number(guests),
      price: 0, // Pending quotation
      balance: 0,
      status: "COTIZACION",
      notes: notes || "Solicitado desde portal cliente."
    }
  });
}

export async function requestPoolAccess(clientId, stayId, data) {
  const { people } = data;

  if (!people || people <= 0) {
    throw new HttpError(422, "Cantidad de personas inválida.");
  }

  // Create an active pool entry directly as a guest
  return await prisma.poolEntry.create({
    data: {
      clientId: clientId,
      type: "HUESPED",
      people: Number(people),
      status: "ACTIVO",
      qrCode: `POOL-${randomUUID().slice(0, 8).toUpperCase()}`
    }
  });
}
