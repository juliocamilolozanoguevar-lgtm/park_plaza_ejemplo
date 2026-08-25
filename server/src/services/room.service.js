import { prisma } from "../config/prisma.js";
import { notFound } from "../utils/httpError.js";

export async function listRooms(query = {}) {
  return prisma.room.findMany({
    where: {
      status: query.status || undefined,
      floor: query.floor ? Number(query.floor) : undefined,
      typeId: query.typeId ? Number(query.typeId) : undefined
    },
    include: { type: true, reservations: true, cleaningTasks: true },
    orderBy: [{ floor: "asc" }, { number: "asc" }]
  });
}

export async function roomCounters() {
  return prisma.room.groupBy({ by: ["status"], _count: true });
}

export async function getRoom(id) {
  const room = await prisma.room.findUnique({
    where: { id },
    include: { type: true, reservations: true, stays: true, cleaningTasks: true }
  });
  if (!room) throw notFound("Habitacion no encontrada.");
  return room;
}

export function createRoom(data) {
  return prisma.room.create({ data });
}

export async function updateRoom(id, data) {
  await getRoom(id);
  return prisma.room.update({ where: { id }, data });
}

export async function deleteRoom(id) {
  await getRoom(id);
  return prisma.room.update({
    where: { id },
    data: { status: "FUERA_SERVICIO" }
  });
}

export function listRoomTypes() {
  return prisma.roomType.findMany({ orderBy: { name: "asc" } });
}

export async function getRoomAvailability(roomId) {
  const room = await getRoom(roomId);
  const reservations = await prisma.reservation.findMany({
    where: {
      roomId,
      status: { in: ["PENDIENTE", "CONFIRMADA", "CHECKED_IN"] }
    },
    include: { client: true },
    orderBy: { checkInDate: "asc" },
    take: 12
  });

  return {
    room,
    status: room.status,
    available: room.status === "LIBRE",
    reservations
  };
}

export async function checkRoomAvailability(roomId, checkIn, checkOut) {
  const room = await prisma.room.findUnique({ where: { id: Number(roomId) } });
  if (!room || room.status !== "LIBRE") {
    return { available: false, message: "La habitacion no esta disponible." };
  }

  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);

  if (Number.isNaN(checkInDate.getTime()) || Number.isNaN(checkOutDate.getTime()) || checkOutDate <= checkInDate) {
    return { available: false, message: "Fechas invalidas." };
  }

  const conflict = await prisma.reservation.findFirst({
    where: {
      roomId,
      status: { in: ["PENDIENTE", "CONFIRMADA", "CHECKED_IN"] },
      checkInDate: { lt: checkOutDate },
      checkOutDate: { gt: checkInDate }
    },
    include: { client: true, room: true }
  });

  if (!conflict) return { available: true };

  return {
    available: false,
    conflict: {
      reservationCode: conflict.code,
      checkIn: conflict.checkInDate,
      checkOut: conflict.checkOutDate,
      client: `${conflict.client.firstName} ${conflict.client.lastName}`
    }
  };
}
