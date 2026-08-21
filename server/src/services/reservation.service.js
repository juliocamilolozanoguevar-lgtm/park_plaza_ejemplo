import { prisma } from "../config/prisma.js";
import { HttpError, notFound } from "../utils/httpError.js";

function asDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new HttpError(422, "Fecha invalida.");
  }
  return date;
}

export async function listReservations(query = {}) {
  return prisma.reservation.findMany({
    where: {
      status: query.status || undefined,
      client: query.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: "insensitive" } },
              { lastName: { contains: query.search, mode: "insensitive" } },
              { documentNumber: { contains: query.search } }
            ]
          }
        : undefined
    },
    include: { client: true, room: { include: { type: true } }, stay: true, payments: true },
    orderBy: { checkInDate: "desc" }
  });
}

export async function getReservation(id) {
  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: { client: true, room: { include: { type: true } }, stay: true, payments: true }
  });
  if (!reservation) throw notFound("Reserva no encontrada.");
  return reservation;
}

export async function createReservation(data) {
  const checkInDate = asDate(data.checkInDate);
  const checkOutDate = asDate(data.checkOutDate);

  if (checkOutDate <= checkInDate) {
    throw new HttpError(422, "La fecha de salida debe ser mayor a la fecha de entrada.");
  }

  const overlapping = await prisma.reservation.findFirst({
    where: {
      roomId: data.roomId,
      status: { in: ["PENDIENTE", "CONFIRMADA", "CHECKED_IN"] },
      checkInDate: { lt: checkOutDate },
      checkOutDate: { gt: checkInDate }
    }
  });

  if (overlapping) {
    throw new HttpError(409, "La habitacion ya tiene una reserva en ese rango de fechas.");
  }

  const balance = Number(data.totalPrice) - Number(data.advance || 0);
  if (balance < 0) {
    throw new HttpError(422, "El adelanto no puede superar el precio total.");
  }
  if (Number(data.advance || 0) > 0 && !data.paymentMethod) {
    throw new HttpError(422, "Selecciona un metodo de pago para registrar el adelanto.");
  }

  const year = new Date().getFullYear();
  const count = await prisma.reservation.count();
  const code = `RSV-${year}-${String(count + 1).padStart(4, "0")}`;

  return prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.create({
      data: {
        code,
        clientId: data.clientId,
        roomId: data.roomId,
        checkInDate,
        checkOutDate,
        adults: data.adults,
        children: data.children || 0,
        totalPrice: data.totalPrice,
        advance: data.advance || 0,
        balance,
        status: data.status || "CONFIRMADA",
        origin: data.origin || "RECEPCION",
        notes: data.notes || null
      },
      include: { client: true, room: true }
    });

    await tx.room.update({
      where: { id: data.roomId },
      data: { status: "RESERVADA" }
    });

    if (Number(data.advance || 0) > 0) {
      const payment = await tx.payment.create({
        data: {
          clientId: data.clientId,
          reservationId: reservation.id,
          method: data.paymentMethod,
          area: "RECEPCION",
          concept: `Adelanto reserva ${code}`,
          amount: data.advance
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
            category: "RECEPCION",
            method: data.paymentMethod,
            concept: `Adelanto reserva ${code}`,
            amount: data.advance
          }
        });
      }
    }

    return reservation;
  });
}

export async function updateReservation(id, data) {
  await getReservation(id);
  const { paymentMethod, ...reservationData } = data;
  return prisma.reservation.update({
    where: { id },
    data: reservationData,
    include: { client: true, room: true }
  });
}

export async function cancelReservation(id) {
  const reservation = await getReservation(id);
  return prisma.$transaction(async (tx) => {
    const updated = await tx.reservation.update({
      where: { id },
      data: { status: "CANCELADA" }
    });
    const activeForRoom = await tx.reservation.count({
      where: {
        roomId: reservation.roomId,
        id: { not: id },
        status: { in: ["PENDIENTE", "CONFIRMADA", "CHECKED_IN"] }
      }
    });
    if (activeForRoom === 0) {
      await tx.room.update({ where: { id: reservation.roomId }, data: { status: "LIBRE" } });
    }
    return updated;
  });
}
