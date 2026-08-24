import { PaymentMethod, Prisma } from "@prisma/client";
import { randomBytes, randomUUID } from "node:crypto";
import { prisma } from "../config/prisma.js";
import { emitToStay } from "../socket.js";
import { HttpError, notFound } from "../utils/httpError.js";

const SERVICE_TYPES = ["PISCINA", "MIRADOR"];
const OCCUPYING_STATUSES = ["PENDIENTE", "CONFIRMADA", "EN_USO"];
const AVAILABILITY_WINDOW_DAYS = 21;
const PAYMENT_METHODS = new Set(Object.values(PaymentMethod));

const DEFAULT_SERVICE_CATALOG = {
  PISCINA: {
    slots: [["09:00", "12:00", 60], ["14:00", "17:00", 60]],
    plans: [
      ["ADULTO", "Adulto", "Acceso general para adulto.", 25, "ADULTO"],
      ["NINO", "Niño", "Acceso para menor de edad.", 15, "NINO"],
      ["FAMILIAR", "Familiar", "Pase familiar para 4 personas.", 70, "FAMILIAR"]
    ],
    extras: [["TOALLA", "Toalla premium", "Toalla para uso en piscina.", 8]]
  },
  MIRADOR: {
    slots: [["16:30", "18:30", 40], ["19:00", "21:00", 40]],
    plans: [["GENERAL", "Acceso mirador", "Reserva de mesa y acceso al mirador.", 20, "PERSONA"]],
    extras: [["DECORACION", "Decoración simple", "Detalle decorativo para la mesa.", 25]]
  }
};

export async function ensureDefaultServiceCatalog() {
  for (const [serviceType, config] of Object.entries(DEFAULT_SERVICE_CATALOG)) {
    for (const [startTime, endTime, capacity] of config.slots) {
      const existing = await prisma.serviceSlot.findFirst({ where: { serviceType, startTime, endTime } });
      if (!existing) await prisma.serviceSlot.create({ data: { serviceType, startTime, endTime, capacity, active: true } });
    }
    for (const [code, name, description, price, pricingMode] of config.plans) {
      const existing = await prisma.servicePlan.findFirst({ where: { serviceType, code } });
      if (!existing) await prisma.servicePlan.create({ data: { serviceType, code, name, description, price, pricingMode, active: true } });
    }
    for (const [name, description, price] of config.extras) {
      const existing = await prisma.serviceExtra.findFirst({ where: { serviceType, name } });
      if (!existing) await prisma.serviceExtra.create({ data: { serviceType, name, description, price, active: true } });
    }
  }
}

function toMoney(value) {
  return new Prisma.Decimal(value || 0).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

function toInt(value, field, { min = 0 } = {}) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min) throw new HttpError(422, `${field} invalido.`);
  return parsed;
}

function assertServiceType(type) {
  const normalized = String(type || "").toUpperCase();
  if (!SERVICE_TYPES.includes(normalized)) throw new HttpError(422, "Servicio no valido.");
  return normalized;
}

function assertPaymentMethod(method) {
  const normalized = String(method || "EFECTIVO").toUpperCase();
  if (!PAYMENT_METHODS.has(normalized)) throw new HttpError(422, "Metodo de pago no valido.");
  return normalized;
}

function limaDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const data = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${data.year}-${data.month}-${data.day}`;
}

function assertDateString(value, field = "Fecha") {
  const date = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError(422, `${field} invalida.`);
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) throw new HttpError(422, `${field} invalida.`);
  return date;
}

function dateFromLimaDay(dateString) {
  const date = assertDateString(dateString);
  return new Date(`${date}T05:00:00.000Z`);
}

function dateRangeForLimaDay(dateString) {
  const start = dateFromLimaDay(dateString);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

function addDays(dateString, days) {
  const date = dateFromLimaDay(dateString);
  date.setUTCDate(date.getUTCDate() + days);
  return limaDateString(date);
}

function assertNotPastDate(dateString) {
  if (dateString < limaDateString()) throw new HttpError(422, "No se puede reservar una fecha pasada.");
}

function minutesFromTime(time) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(time || ""));
  if (!match) throw new HttpError(422, "Horario invalido.");
  return Number(match[1]) * 60 + Number(match[2]);
}

function currentLimaMinutes() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Lima",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(new Date());
  const data = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return Number(data.hour) * 60 + Number(data.minute);
}

function retryableTransaction(error) {
  return error?.code === "P2034" || error?.meta?.code === "40001" || error?.code === "40001";
}

async function withSerializableRetry(operation) {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
      });
    } catch (error) {
      if (!retryableTransaction(error) || attempt === maxAttempts) throw error;
    }
  }
  throw new HttpError(409, "Conflicto de concurrencia al reservar servicio. Intente nuevamente.");
}

function serviceCode(type) {
  const segment = type === "PISCINA" ? "PIS" : "MIR";
  return `SRV-${segment}-${new Date().getFullYear()}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

function emitServiceReservation(event, reservation) {
  if (!reservation?.stayId) return;
  emitToStay(reservation.stayId, event, socketPayload(reservation));
}

function socketPayload(reservation) {
  return {
    id: reservation.id,
    code: reservation.code,
    serviceType: reservation.serviceType,
    status: reservation.status,
    date: reservation.date,
    updatedAt: reservation.updatedAt
  };
}

function qrVisible(reservation) {
  return reservation.status === "CONFIRMADA" ? reservation.qrCode : null;
}

export function formatServiceReservationDTO(res) {
  return {
    id: res.id,
    code: res.code,
    serviceType: res.serviceType,
    status: res.status,
    date: limaDateString(res.date),
    slot: res.slot ? formatServiceSlotDTO(res.slot) : null,
    adults: res.adults,
    children: res.children,
    people: res.people,
    plan: res.plan ? formatServicePlanDTO(res.plan) : (res.planCode ? { code: res.planCode, name: res.planName } : null),
    extras: res.extras ? res.extras.map((item) => ({
      id: item.serviceExtraId,
      name: item.serviceExtra?.name,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      subtotal: Number(item.subtotal)
    })) : [],
    baseAmount: Number(res.baseAmount),
    extrasAmount: Number(res.extrasAmount),
    totalAmount: Number(res.totalAmount),
    advance: Number(res.advance),
    balance: Number(res.balance),
    qrCode: qrVisible(res),
    notes: res.notes,
    createdAt: res.createdAt,
    updatedAt: res.updatedAt,
    cancelledAt: res.cancelledAt,
    checkedInAt: res.checkedInAt,
    completedAt: res.completedAt
  };
}

export function formatServiceSlotDTO(slot) {
  return {
    id: slot.id,
    startTime: slot.startTime,
    endTime: slot.endTime,
    capacity: slot.capacity,
    remaining: slot.remaining,
    available: slot.available !== undefined ? slot.available : true
  };
}

export function formatServicePlanDTO(plan) {
  return {
    id: plan.id,
    code: plan.code,
    name: plan.name,
    price: Number(plan.price),
    pricingMode: plan.pricingMode,
    description: plan.description
  };
}

export function formatServiceExtraDTO(extra) {
  return {
    id: extra.id,
    name: extra.name,
    price: Number(extra.price),
    description: extra.description
  };
}

export async function getPublicServices() {
  return [
    { code: "PISCINA", name: "Piscina", active: true },
    { code: "MIRADOR", name: "Mirador", active: true }
  ];
}

export async function getServiceAvailability(type, query = {}) {
  const serviceType = assertServiceType(type);
  const startDate = assertDateString(query.from || query.date, "Fecha");
  const days = query.from ? AVAILABILITY_WINDOW_DAYS : 1;
  const dates = Array.from({ length: days }, (_, index) => addDays(startDate, index));
  const slots = await prisma.serviceSlot.findMany({
    where: { serviceType, active: true },
    orderBy: { startTime: "asc" }
  });

  const firstRange = dateRangeForLimaDay(dates[0]);
  const lastRange = dateRangeForLimaDay(dates[dates.length - 1]);
  const reservations = await prisma.serviceReservation.findMany({
    where: {
      serviceType,
      date: { gte: firstRange.start, lt: lastRange.end },
      status: { in: OCCUPYING_STATUSES }
    },
    select: { date: true, slotId: true, people: true }
  });

  return dates.map((date) => {
    const dayReservations = reservations.filter((reservation) => limaDateString(reservation.date) === date);
    return {
      date,
      slots: slots.map((slot) => {
        const used = dayReservations
          .filter((reservation) => reservation.slotId === slot.id)
          .reduce((sum, reservation) => sum + reservation.people, 0);
        const remaining = slot.capacity - used;
        return {
          ...formatServiceSlotDTO(slot),
          remaining: Math.max(0, remaining),
          available: remaining > 0
        };
      })
    };
  });
}

export async function getServicePlans(type) {
  const serviceType = assertServiceType(type);
  const plans = await prisma.servicePlan.findMany({
    where: { serviceType, active: true },
    orderBy: { name: "asc" }
  });
  return plans.map(formatServicePlanDTO);
}

export async function getServiceExtras(type) {
  const serviceType = assertServiceType(type);
  const extras = await prisma.serviceExtra.findMany({
    where: { serviceType, active: true },
    orderBy: { name: "asc" }
  });
  return extras.map(formatServiceExtraDTO);
}

function calculateBaseAmount(plan, adults, children, people) {
  const price = toMoney(plan.price);
  if (plan.pricingMode === "ADULTO") return price.times(adults);
  if (plan.pricingMode === "NINO") return price.times(children);
  if (plan.pricingMode === "PERSONA") return price.times(people);
  if (plan.pricingMode === "FIJO") return price;
  if (plan.pricingMode === "FAMILIAR") return price;
  throw new HttpError(422, "Modo de precio no soportado.");
}

async function resolveReservationPayload(tx, data) {
  const serviceType = assertServiceType(data.serviceType);
  const dateString = assertDateString(data.date, "Fecha");
  assertNotPastDate(dateString);
  const date = dateFromLimaDay(dateString);
  const adults = toInt(data.adults || 0, "Adultos", { min: 0 });
  const children = toInt(data.children || 0, "Ninos", { min: 0 });
  const people = adults + children;
  if (people <= 0) throw new HttpError(422, "Debe indicar cantidad de personas.");

  const slot = await tx.serviceSlot.findUnique({ where: { id: Number(data.slotId) } });
  if (!slot || !slot.active || slot.serviceType !== serviceType) throw new HttpError(422, "Horario no valido.");
  if (slot.capacity <= 0) throw new HttpError(422, "Horario sin capacidad disponible.");

  const plan = await tx.servicePlan.findUnique({ where: { id: Number(data.planId) } });
  if (!plan || !plan.active || plan.serviceType !== serviceType) throw new HttpError(422, "Plan no valido para el servicio.");

  const reservations = await tx.serviceReservation.findMany({
    where: {
      serviceType,
      date,
      slotId: slot.id,
      status: { in: OCCUPYING_STATUSES }
    },
    select: { people: true }
  });
  const used = reservations.reduce((sum, reservation) => sum + reservation.people, 0);
  if (slot.capacity - used < people) throw new HttpError(409, "Capacidad excedida en el horario seleccionado.");

  const baseAmount = calculateBaseAmount(plan, adults, children, people);
  let extrasAmount = toMoney(0);
  const extrasInput = [];

  for (const item of data.extras || []) {
    const quantity = toInt(item.quantity, "Cantidad de extra", { min: 1 });
    const extra = await tx.serviceExtra.findUnique({ where: { id: Number(item.id) } });
    if (!extra || !extra.active || extra.serviceType !== serviceType) throw new HttpError(422, "Extra no valido para el servicio.");
    const unitPrice = toMoney(extra.price);
    const subtotal = unitPrice.times(quantity).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    extrasAmount = extrasAmount.plus(subtotal).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    extrasInput.push({ serviceExtraId: extra.id, quantity, unitPrice, subtotal });
  }

  const totalAmount = baseAmount.plus(extrasAmount).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  return { serviceType, date, adults, children, people, slot, plan, baseAmount, extrasAmount, totalAmount, extrasInput };
}

export async function createServiceReservation(clientId, stayId, reservationId, data) {
  let created;
  try {
    created = await withSerializableRetry(async (tx) => {
      const payload = await resolveReservationPayload(tx, data);
      const newReservation = await tx.serviceReservation.create({
        data: {
          code: serviceCode(payload.serviceType),
          clientId: Number(clientId),
          stayId: stayId ? Number(stayId) : null,
          reservationId: reservationId ? Number(reservationId) : null,
          serviceType: payload.serviceType,
          status: "PENDIENTE",
          date: payload.date,
          slotId: payload.slot.id,
          adults: payload.adults,
          children: payload.children,
          people: payload.people,
          planId: payload.plan.id,
          planCode: payload.plan.code,
          planName: payload.plan.name,
          baseAmount: payload.baseAmount,
          extrasAmount: payload.extrasAmount,
          totalAmount: payload.totalAmount,
          advance: toMoney(0),
          balance: payload.totalAmount,
          qrCode: randomUUID(),
          notes: data.notes || null,
          extras: { create: payload.extrasInput }
        },
        include: includeReservation()
      });
      return newReservation;
    });
  } catch (error) {
    if (retryableTransaction(error)) throw new HttpError(409, "Conflicto de concurrencia al reservar servicio. Intente nuevamente.");
    throw error;
  }
  emitServiceReservation("service-reservation:created", created);
  return formatServiceReservationDTO(created);
}

function includeReservation() {
  return {
    slot: true,
    plan: true,
    extras: { include: { serviceExtra: true } }
  };
}

function clientOwnershipWhere(clientId, stayId, id) {
  return { id: Number(id), clientId: Number(clientId), stayId: stayId ? Number(stayId) : null };
}

export async function getClientServiceReservations(clientId, stayId) {
  const reservations = await prisma.serviceReservation.findMany({
    where: { clientId: Number(clientId), stayId: stayId ? Number(stayId) : null },
    include: includeReservation(),
    orderBy: [{ date: "desc" }, { createdAt: "desc" }]
  });
  return reservations.map(formatServiceReservationDTO);
}

export async function listServiceReservations() {
  return prisma.serviceReservation.findMany({
    include: {
      client: true,
      slot: true,
      plan: true,
      extras: { include: { serviceExtra: true } }
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 200
  });
}

export async function getClientServiceReservationById(clientId, stayId, id) {
  const reservation = await prisma.serviceReservation.findFirst({
    where: clientOwnershipWhere(clientId, stayId, id),
    include: includeReservation()
  });
  if (!reservation) throw notFound("Reserva de servicio no encontrada.");
  return formatServiceReservationDTO(reservation);
}

export async function cancelServiceReservation(clientId, stayId, id) {
  const result = await prisma.$transaction(async (tx) => {
    const reservation = await tx.serviceReservation.findFirst({
      where: clientOwnershipWhere(clientId, stayId, id),
      include: { payments: true }
    });
    if (!reservation) throw notFound("Reserva de servicio no encontrada.");
    if (!["PENDIENTE", "CONFIRMADA"].includes(reservation.status)) {
      throw new HttpError(422, `No se puede cancelar la reserva en estado ${reservation.status}.`);
    }
    return tx.serviceReservation.update({
      where: { id: reservation.id },
      data: {
        status: "CANCELADA",
        cancelledAt: new Date(),
        notes: reservation.payments.length
          ? `${reservation.notes || ""}\nCancelada con pagos registrados. Devolucion no automatizada.`.trim()
          : reservation.notes
      },
      include: includeReservation()
    });
  });
  emitServiceReservation("service-reservation:cancelled", result);
  return formatServiceReservationDTO(result);
}

export async function payServiceReservation(clientId, stayId, id, data = {}) {
  const method = assertPaymentMethod(data.method);
  const result = await prisma.$transaction(async (tx) => {
    const reservation = await tx.serviceReservation.findFirst({
      where: clientOwnershipWhere(clientId, stayId, id),
      include: { payments: true }
    });
    if (!reservation) throw notFound("Reserva de servicio no encontrada.");
    if (["CANCELADA", "FINALIZADA"].includes(reservation.status)) {
      throw new HttpError(422, `No se puede pagar una reserva en estado ${reservation.status}.`);
    }

    const amount = toMoney(data.amount);
    if (amount.lte(0)) throw new HttpError(422, "El monto debe ser mayor a cero.");
    const currentAdvance = reservation.payments
      .filter((payment) => payment.status === "REGISTRADO")
      .reduce((sum, payment) => sum.plus(payment.amount), toMoney(0));
    const totalAmount = toMoney(reservation.totalAmount);
    const nextAdvance = currentAdvance.plus(amount).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    if (nextAdvance.gt(totalAmount)) throw new HttpError(422, "El pago excede el saldo pendiente.");

    const balance = totalAmount.minus(nextAdvance).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    await tx.payment.create({
      data: {
        clientId: reservation.clientId,
        reservationId: reservation.reservationId,
        stayId: reservation.stayId,
        serviceReservationId: reservation.id,
        method,
        reference: data.reference || null,
        status: "REGISTRADO",
        area: reservation.serviceType,
        concept: `Pago reserva servicio ${reservation.code}`,
        amount
      }
    });

    return tx.serviceReservation.update({
      where: { id: reservation.id },
      data: {
        advance: nextAdvance,
        balance,
        status: balance.equals(0) ? "CONFIRMADA" : reservation.status
      },
      include: includeReservation()
    });
  });
  emitServiceReservation("service-reservation:updated", result);
  return formatServiceReservationDTO(result);
}

async function assertCheckInWindow(reservation, slot) {
  const today = limaDateString();
  const reservationDate = limaDateString(reservation.date);
  if (reservationDate !== today) throw new HttpError(422, "La reserva no corresponde al dia actual.");
  const nowMinutes = currentLimaMinutes();
  const start = minutesFromTime(slot.startTime);
  const end = minutesFromTime(slot.endTime);
  if (nowMinutes < start || nowMinutes > end) throw new HttpError(422, "La reserva no esta dentro del horario permitido.");
}

export async function checkInServiceReservation(id, user, expectedType = null, qrCode = null) {
  const result = await prisma.$transaction(async (tx) => {
    const reservation = await tx.serviceReservation.findUnique({
      where: { id: Number(id) },
      include: { slot: true, poolEntries: true }
    });
    if (!reservation) throw notFound("Reserva no encontrada.");
    const serviceType = expectedType ? assertServiceType(expectedType) : reservation.serviceType;
    if (reservation.serviceType !== serviceType) throw new HttpError(422, `La reserva no pertenece a ${serviceType}.`);
    if (reservation.status !== "CONFIRMADA") throw new HttpError(422, `No se puede hacer check-in. Estado actual: ${reservation.status}.`);
    if (!reservation.qrCode) throw new HttpError(422, "La reserva no tiene QR valido.");
    if (!qrCode) throw new HttpError(422, "QR requerido para check-in.");
    if (String(qrCode) !== reservation.qrCode) throw new HttpError(422, "QR invalido para la reserva.");
    if (reservation.checkedInAt) throw new HttpError(422, "La reserva ya tiene check-in registrado.");
    await assertCheckInWindow(reservation, reservation.slot);

    if (reservation.serviceType === "PISCINA") {
      const activeEntry = await tx.poolEntry.findFirst({
        where: { serviceReservationId: reservation.id, status: "ACTIVO" }
      });
      if (activeEntry) throw new HttpError(422, "Ya existe una entrada activa para esta reserva.");
    }

    const updated = await tx.serviceReservation.update({
      where: { id: reservation.id },
      data: { status: "EN_USO", checkedInAt: new Date() },
      include: includeReservation()
    });

    if (reservation.serviceType === "PISCINA") {
      await tx.poolEntry.create({
        data: {
          clientId: reservation.clientId,
          reservationId: reservation.reservationId,
          serviceReservationId: reservation.id,
          type: reservation.stayId ? "HUESPED" : "CLIENTE_EXTERNO",
          qrCode: reservation.qrCode,
          people: reservation.people,
          status: "ACTIVO",
          createdById: user?.id || null
        }
      });
    }
    return updated;
  });
  emitServiceReservation("service-reservation:updated", result);
  return formatServiceReservationDTO(result);
}

export async function completeServiceReservation(id, expectedType = null) {
  const result = await prisma.$transaction(async (tx) => {
    const reservation = await tx.serviceReservation.findUnique({
      where: { id: Number(id) },
      include: { poolEntries: true }
    });
    if (!reservation) throw notFound("Reserva no encontrada.");
    const serviceType = expectedType ? assertServiceType(expectedType) : reservation.serviceType;
    if (reservation.serviceType !== serviceType) throw new HttpError(422, `La reserva no pertenece a ${serviceType}.`);
    if (reservation.status !== "EN_USO") throw new HttpError(422, `No se puede completar. Estado actual: ${reservation.status}.`);
    if (reservation.completedAt) throw new HttpError(422, "La reserva ya fue finalizada.");

    if (reservation.serviceType === "PISCINA") {
      const poolEntry = await tx.poolEntry.findFirst({
        where: { serviceReservationId: reservation.id, status: "ACTIVO" }
      });
      if (!poolEntry) throw new HttpError(422, "No existe una entrada activa de piscina para finalizar.");
      await tx.poolEntry.update({
        where: { id: poolEntry.id },
        data: { status: "FINALIZADO", exitAt: new Date() }
      });
    }

    return tx.serviceReservation.update({
      where: { id: reservation.id },
      data: { status: "FINALIZADA", completedAt: new Date() },
      include: includeReservation()
    });
  });
  emitServiceReservation("service-reservation:updated", result);
  return formatServiceReservationDTO(result);
}
