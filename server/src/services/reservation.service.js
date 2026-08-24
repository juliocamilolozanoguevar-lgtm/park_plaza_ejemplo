import { prisma } from "../config/prisma.js";
import { createPayment } from "./admin.service.js";
import { HttpError, notFound } from "../utils/httpError.js";

function asDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new HttpError(422, "Fecha invalida.");
  }
  return date;
}

const PAYMENT_METHODS = new Set(["EFECTIVO", "TARJETA", "YAPE", "PLIN", "TRANSFERENCIA"]);

export async function listReservations(query = {}) {
  return prisma.reservation.findMany({
    where: {
      status: query.status || { notIn: ["CANCELADA", "NO_SHOW"] },
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

  const room = await prisma.room.findUnique({ where: { id: Number(data.roomId) } });
  if (!room || room.status !== "LIBRE") {
    throw new HttpError(409, "La habitacion no esta disponible para reservar.");
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
    const currentRoom = await tx.room.findUnique({ where: { id: Number(data.roomId) } });
    if (!currentRoom || currentRoom.status !== "LIBRE") {
      throw new HttpError(409, "La habitacion no esta disponible para reservar.");
    }

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
  const current = await getReservation(id);
  const { paymentMethod, ...reservationData } = data;
  const nextRoomId = Number(reservationData.roomId || current.roomId);
  const nextCheckInDate = reservationData.checkInDate ? asDate(reservationData.checkInDate) : current.checkInDate;
  const nextCheckOutDate = reservationData.checkOutDate ? asDate(reservationData.checkOutDate) : current.checkOutDate;

  if (nextCheckOutDate <= nextCheckInDate) {
    throw new HttpError(422, "La fecha de salida debe ser mayor a la fecha de entrada.");
  }

  const conflict = await prisma.reservation.findFirst({
    where: {
      id: { not: id },
      roomId: nextRoomId,
      status: { in: ["PENDIENTE", "CONFIRMADA", "CHECKED_IN"] },
      checkInDate: { lt: nextCheckOutDate },
      checkOutDate: { gt: nextCheckInDate }
    }
  });
  if (conflict) throw new HttpError(409, "La habitacion ya tiene una reserva en ese rango de fechas.");

  return prisma.$transaction(async (tx) => {
    if (nextRoomId !== current.roomId) {
      const nextRoom = await tx.room.findUnique({ where: { id: nextRoomId } });
      if (!nextRoom || nextRoom.status !== "LIBRE") throw new HttpError(409, "La habitacion no esta disponible para reservar.");
    }

    const updated = await tx.reservation.update({
      where: { id },
      data: {
        ...reservationData,
        roomId: nextRoomId,
        checkInDate: nextCheckInDate,
        checkOutDate: nextCheckOutDate
      },
      include: { client: true, room: true }
    });

    if (nextRoomId !== current.roomId) {
      const activeForOldRoom = await tx.reservation.count({
        where: {
          roomId: current.roomId,
          id: { not: id },
          status: { in: ["PENDIENTE", "CONFIRMADA", "CHECKED_IN"] }
        }
      });
      if (activeForOldRoom === 0) await tx.room.update({ where: { id: current.roomId }, data: { status: "LIBRE" } });
      await tx.room.update({ where: { id: nextRoomId }, data: { status: "RESERVADA" } });
    }

    return updated;
  });
}

export async function cancelReservation(id) {
  const reservation = await getReservation(id);
  return prisma.$transaction(async (tx) => {
    const servicePayments = await tx.payment.count({
      where: { serviceReservation: { reservationId: id } }
    });
    const hasPayments = reservation.payments.length > 0 || servicePayments > 0;

    if (!hasPayments && !reservation.stay) {
      const serviceReservations = await tx.serviceReservation.findMany({
        where: { reservationId: id },
        select: { id: true }
      });
      const serviceReservationIds = serviceReservations.map((item) => item.id);

      if (serviceReservationIds.length) {
        await tx.serviceReservationExtra.deleteMany({ where: { serviceReservationId: { in: serviceReservationIds } } });
        await tx.poolEntry.deleteMany({ where: { serviceReservationId: { in: serviceReservationIds } } });
        await tx.serviceReservation.deleteMany({ where: { id: { in: serviceReservationIds } } });
      }
      await tx.poolEntry.deleteMany({ where: { reservationId: id } });
      await tx.reservation.delete({ where: { id } });

      const activeForRoom = await tx.reservation.count({
        where: {
          roomId: reservation.roomId,
          status: { in: ["PENDIENTE", "CONFIRMADA", "CHECKED_IN"] }
        }
      });
      if (activeForRoom === 0) {
        await tx.room.update({ where: { id: reservation.roomId }, data: { status: "LIBRE" } });
      }
      return { ...reservation, deleted: true };
    }

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

export async function confirmReservationPayment(id, data = {}, userId) {
  const reservation = await getReservation(id);
  const amount = Number(reservation.balance || 0);
  const method = String(data.method || "EFECTIVO").toUpperCase();
  if (!PAYMENT_METHODS.has(method)) throw new HttpError(422, "Metodo de pago no valido.");
  if (amount <= 0) throw new HttpError(422, "La reserva no tiene saldo pendiente.");
  if (["CANCELADA", "NO_SHOW", "COMPLETADA"].includes(reservation.status)) {
    throw new HttpError(422, "No se puede confirmar pago para esta reserva.");
  }

  await createPayment({
    clientId: reservation.clientId,
    reservationId: reservation.id,
    area: "RECEPCION",
    concept: `Pago reserva ${reservation.code}`,
    method,
    reference: data.reference || null,
    amount
  }, userId);

  return getReservation(id);
}

export async function confirmReservationCashPayment(id, userId) {
  return confirmReservationPayment(id, { method: "EFECTIVO" }, userId);
}
