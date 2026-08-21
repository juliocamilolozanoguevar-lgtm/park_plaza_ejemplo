import { prisma } from "../config/prisma.js";
import { HttpError, notFound } from "../utils/httpError.js";

export async function searchReservations(term) {
  return prisma.reservation.findMany({
    where: {
      OR: [
        { code: { contains: term, mode: "insensitive" } },
        { client: { documentNumber: { contains: term } } },
        { client: { firstName: { contains: term, mode: "insensitive" } } },
        { client: { lastName: { contains: term, mode: "insensitive" } } },
        { room: { number: { contains: term } } }
      ]
    },
    include: { client: true, room: { include: { type: true } }, stay: true }
  });
}

export async function checkIn(reservationId) {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { stay: true, room: true, client: true }
  });

  if (!reservation) throw notFound("Reserva no encontrada.");
  if (reservation.stay) throw new HttpError(409, "La reserva ya tiene check-in.");
  if (!["CONFIRMADA", "PENDIENTE"].includes(reservation.status)) {
    throw new HttpError(422, "La reserva no se puede registrar como check-in.");
  }

  return prisma.$transaction(async (tx) => {
    const stay = await tx.stay.create({
      data: {
        reservationId: reservation.id,
        clientId: reservation.clientId,
        roomId: reservation.roomId,
        status: "ACTIVA"
      },
      include: { client: true, room: true, reservation: true }
    });

    await tx.reservation.update({
      where: { id: reservation.id },
      data: { status: "CHECKED_IN" }
    });

    await tx.room.update({
      where: { id: reservation.roomId },
      data: { status: "OCUPADA" }
    });

    await tx.client.update({
      where: { id: reservation.clientId },
      data: { status: "HOSPEDADO" }
    });

    return stay;
  });
}

export async function activeStays(search = "") {
  return prisma.stay.findMany({
    where: {
      status: "ACTIVA",
      OR: search
        ? [
            { client: { firstName: { contains: search, mode: "insensitive" } } },
            { client: { lastName: { contains: search, mode: "insensitive" } } },
            { client: { documentNumber: { contains: search } } },
            { room: { number: { contains: search } } }
          ]
        : undefined
    },
    include: {
      client: true,
      room: { include: { type: true } },
      reservation: true,
      consumptions: true,
      payments: true
    },
    orderBy: { checkInAt: "desc" }
  });
}

export async function checkout(stayId, paymentAmount = 0, paymentMethod = "EFECTIVO") {
  const stay = await prisma.stay.findUnique({
    where: { id: stayId },
    include: {
      reservation: true,
      consumptions: true,
      payments: true,
      room: true,
      client: true
    }
  });

  if (!stay) throw notFound("Estadia no encontrada.");
  if (stay.status !== "ACTIVA") throw new HttpError(422, "La estadia ya fue finalizada.");

  const consumptionTotal = stay.consumptions.reduce((sum, item) => sum + Number(item.amount), 0);
  const reservationTotal = Number(stay.reservation.totalPrice);
  const paidTotal = stay.payments.reduce((sum, item) => sum + Number(item.amount), 0);
  const finalPaid = paidTotal + Number(paymentAmount || 0);
  const totalDue = reservationTotal + consumptionTotal;

  if (finalPaid < totalDue) {
    throw new HttpError(422, "Existe saldo pendiente para finalizar check-out.");
  }

  return prisma.$transaction(async (tx) => {
    let payment = null;
    if (Number(paymentAmount || 0) > 0) {
      payment = await tx.payment.create({
        data: {
          clientId: stay.clientId,
          reservationId: stay.reservationId,
          stayId: stay.id,
          method: paymentMethod,
          area: "RECEPCION",
          concept: `Pago check-out habitacion ${stay.room.number}`,
          amount: paymentAmount
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
            method: paymentMethod,
            concept: `Ingreso por check-out habitacion ${stay.room.number}`,
            amount: paymentAmount
          }
        });
      }
    }

    const updatedStay = await tx.stay.update({
      where: { id: stay.id },
      data: { status: "FINALIZADA", checkOutAt: new Date() }
    });

    await tx.reservation.update({
      where: { id: stay.reservationId },
      data: { status: "COMPLETADA", balance: 0 }
    });

    await tx.room.update({
      where: { id: stay.roomId },
      data: { status: "EN_LIMPIEZA" }
    });

    await tx.cleaningTask.create({
      data: {
        roomId: stay.roomId,
        status: "PENDIENTE",
        priority: "ALTA",
        checkoutAt: new Date()
      }
    });

    const activeClientStays = await tx.stay.count({
      where: { clientId: stay.clientId, id: { not: stay.id }, status: "ACTIVA" }
    });
    if (activeClientStays === 0) {
      await tx.client.update({ where: { id: stay.clientId }, data: { status: "ACTIVO" } });
    }

    return { stay: updatedStay, payment };
  });
}
