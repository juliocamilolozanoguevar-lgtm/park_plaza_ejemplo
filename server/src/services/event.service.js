import { prisma } from "../config/prisma.js";
import { HttpError, notFound } from "../utils/httpError.js";

function asDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new HttpError(422, "Fecha invalida.");
  return date;
}

function codeFor(id) {
  return `EVT-${new Date().getFullYear()}-${String(id).padStart(4, "0")}`;
}

function eventInclude() {
  return { client: true, space: true, payments: true };
}

export function listEventSpaces() {
  return prisma.eventSpace.findMany({ where: { active: true }, orderBy: { name: "asc" } });
}

export function listEvents(query = {}) {
  const where = {};
  if (query.from || query.to) {
    where.startsAt = {
      gte: query.from ? asDate(query.from) : undefined,
      lte: query.to ? asDate(query.to) : undefined
    };
  }
  if (query.status) where.status = query.status;
  if (query.spaceId) where.spaceId = Number(query.spaceId);
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: "insensitive" } },
      { type: { contains: query.search, mode: "insensitive" } },
      { client: { firstName: { contains: query.search, mode: "insensitive" } } },
      { client: { lastName: { contains: query.search, mode: "insensitive" } } },
      { client: { documentNumber: { contains: query.search } } }
    ];
  }

  return prisma.event.findMany({
    where,
    include: eventInclude(),
    orderBy: { startsAt: "asc" }
  });
}

export async function getEvent(id) {
  const event = await prisma.event.findUnique({ where: { id }, include: eventInclude() });
  if (!event) throw notFound("Evento no encontrado.");
  return event;
}

async function validateEvent(data, excludedId) {
  const startsAt = asDate(data.startsAt);
  const endsAt = asDate(data.endsAt);
  if (endsAt <= startsAt) throw new HttpError(422, "La hora final debe ser mayor a la hora inicial.");

  const space = await prisma.eventSpace.findUnique({ where: { id: Number(data.spaceId) } });
  if (!space || !space.active) throw new HttpError(422, "Espacio no disponible.");
  if (Number(data.guests) > space.capacity) throw new HttpError(422, `El espacio ${space.name} tiene capacidad maxima de ${space.capacity} invitados.`);

  const overlap = await prisma.event.findFirst({
    where: {
      id: excludedId ? { not: excludedId } : undefined,
      spaceId: Number(data.spaceId),
      status: { in: ["COTIZACION", "RESERVADO", "CONFIRMADO"] },
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt }
    }
  });
  if (overlap) throw new HttpError(409, "Ya existe un evento en ese espacio y horario.");

  const price = Number(data.price || 0);
  const advance = Number(data.advance || 0);
  if (price < 0 || advance < 0) throw new HttpError(422, "Los importes no pueden ser negativos.");
  if (advance > price) throw new HttpError(422, "El adelanto no puede superar el precio.");

  return { startsAt, endsAt, price, advance, balance: price - advance };
}

export async function createEvent(data, userId) {
  const parsed = await validateEvent(data);
  const event = await prisma.event.create({
    data: {
      clientId: Number(data.clientId),
      spaceId: Number(data.spaceId),
      name: data.name,
      type: data.type,
      startsAt: parsed.startsAt,
      endsAt: parsed.endsAt,
      guests: Number(data.guests),
      price: parsed.price,
      advance: parsed.advance,
      balance: parsed.balance,
      status: data.status || "RESERVADO",
      notes: data.notes || null,
      createdById: userId
    },
    include: eventInclude()
  });
  return { ...event, code: codeFor(event.id) };
}

export async function updateEvent(id, data) {
  await getEvent(id);
  const parsed = await validateEvent(data, id);
  return prisma.event.update({
    where: { id },
    data: {
      clientId: Number(data.clientId),
      spaceId: Number(data.spaceId),
      name: data.name,
      type: data.type,
      startsAt: parsed.startsAt,
      endsAt: parsed.endsAt,
      guests: Number(data.guests),
      price: parsed.price,
      advance: parsed.advance,
      balance: parsed.balance,
      status: data.status,
      notes: data.notes || null
    },
    include: eventInclude()
  });
}

export async function updateEventStatus(id, status) {
  if (!["COTIZACION", "RESERVADO", "CONFIRMADO", "FINALIZADO", "CANCELADO"].includes(status)) {
    throw new HttpError(422, "Estado de evento invalido.");
  }
  await getEvent(id);
  return prisma.event.update({ where: { id }, data: { status }, include: eventInclude() });
}

export async function registerEventPayment(id, data, userId) {
  const event = await getEvent(id);
  const amount = Number(data.amount || 0);
  if (amount <= 0) throw new HttpError(422, "El pago debe ser mayor a cero.");
  if (amount > Number(event.balance)) throw new HttpError(422, "El pago no puede superar el saldo.");

  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        eventId: id,
        clientId: event.clientId,
        amount,
        method: data.method,
        reference: data.reference || null,
        area: "EVENTOS",
        concept: `Pago evento ${event.name}`,
        createdById: userId
      }
    });

    const cashRegister = await tx.cashRegister.findFirst({
      where: { status: "ABIERTA" },
      orderBy: { openedAt: "desc" }
    });

    if (cashRegister) {
      await tx.cashMovement.create({
        data: {
          cashRegisterId: cashRegister.id,
          paymentId: payment.id,
          type: "INGRESO",
          category: "EVENTOS",
          method: data.method,
          concept: `Pago evento ${event.name}`,
          amount
        }
      });
    }

    return tx.event.update({
      where: { id },
      data: {
        advance: Number(event.advance) + amount,
        balance: Number(event.balance) - amount,
        status: Number(event.balance) - amount === 0 ? "CONFIRMADO" : event.status
      },
      include: eventInclude()
    });
  });
}
