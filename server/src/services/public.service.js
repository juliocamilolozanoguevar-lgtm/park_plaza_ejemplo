
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { prisma } from "../config/prisma.js";
import { HttpError, notFound } from "../utils/httpError.js";

function parseDate(value, field) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) throw new HttpError(422, `${field} invalida.`);
  return date;
}

function nightsBetween(checkInDate, checkOutDate) {
  const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
  if (nights <= 0) throw new HttpError(422, "La fecha de salida debe ser mayor a la fecha de entrada.");
  return nights;
}

function money(value) {
  return Number(value || 0);
}

function reservationCode() {
  const year = new Date().getFullYear();
  return `WEB-${year}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function retryableTransaction(error) {
  return error?.code === "P2034";
}

function publicRoom(room) {
  return {
    id: room.id,
    number: room.number,
    floor: room.floor,
    type: room.type ? {
      id: room.type.id,
      name: room.type.name,
      description: room.type.description,
      basePrice: money(room.type.basePrice),
      capacity: room.type.capacity
    } : null,
    price: money(room.price),
    capacity: room.capacity,
    description: room.description,
    status: room.status
  };
}

function publicReservation(reservation) {
  return {
    id: reservation.id,
    code: reservation.code,
    status: reservation.status,
    origin: reservation.origin,
    checkInDate: reservation.checkInDate,
    checkOutDate: reservation.checkOutDate,
    adults: reservation.adults,
    children: reservation.children,
    totalPrice: money(reservation.totalPrice),
    advance: money(reservation.advance),
    balance: money(reservation.balance),
    notes: reservation.notes,
    client: reservation.client ? {
      firstName: reservation.client.firstName,
      lastName: reservation.client.lastName,
      documentType: reservation.client.documentType,
      documentNumber: reservation.client.documentNumber,
      phone: reservation.client.phone,
      email: reservation.client.email
    } : null,
    room: reservation.room ? publicRoom(reservation.room) : null
  };
}
export async function getHotelInfo() {
  const settings = await prisma.hotelSettings.findUnique({ where: { id: 1 } });
  return {
    name: settings?.hotelName || "Hotel Park Plaza",
    ruc: settings?.ruc || null,
    address: settings?.address || null,
    phone: settings?.phone || null,
    email: settings?.email || null,
    logoUrl: settings?.logoUrl || null,
    currency: settings?.currency || "PEN"
  };
}

export async function listPublicRoomTypes() {
  const types = await prisma.roomType.findMany({ where: { active: true }, orderBy: { basePrice: "asc" } });
  return types.map((type) => ({
    id: type.id,
    name: type.name,
    description: type.description,
    basePrice: money(type.basePrice),
    capacity: type.capacity
  }));
}

export async function listAvailableRooms(query = {}) {
  const checkInDate = parseDate(query.checkIn, "Fecha de entrada");
  const checkOutDate = parseDate(query.checkOut, "Fecha de salida");
  const nights = nightsBetween(checkInDate, checkOutDate);
  const guests = query.guests ? Number(query.guests) : 1;

  if (!Number.isInteger(guests) || guests <= 0) throw new HttpError(422, "La cantidad de huespedes es invalida.");

  const rooms = await prisma.room.findMany({
    where: {
      status: "LIBRE",
      capacity: { gte: guests },
      typeId: query.typeId ? Number(query.typeId) : undefined,
      reservations: {
        none: {
          status: { in: ["PENDIENTE", "CONFIRMADA", "CHECKED_IN"] },
          checkInDate: { lt: checkOutDate },
          checkOutDate: { gt: checkInDate }
        }
      }
    },
    include: { type: true },
    orderBy: [{ price: "asc" }, { number: "asc" }]
  });

  return {
    checkIn: checkInDate,
    checkOut: checkOutDate,
    nights,
    guests,
    rooms: rooms.map((room) => ({ ...publicRoom(room), estimatedTotal: money(room.price) * nights }))
  };
}
export async function createPublicReservation(data = {}) {
  const checkInDate = parseDate(data.checkInDate, "Fecha de entrada");
  const checkOutDate = parseDate(data.checkOutDate, "Fecha de salida");
  const nights = nightsBetween(checkInDate, checkOutDate);
  const adults = Number(data.adults || 1);
  const children = Number(data.children || 0);
  const roomId = Number(data.roomId);

  if (!roomId || !Number.isInteger(roomId)) throw new HttpError(422, "Selecciona una habitacion valida.");
  if (!Number.isInteger(adults) || adults <= 0) throw new HttpError(422, "La cantidad de adultos es invalida.");
  if (!Number.isInteger(children) || children < 0) throw new HttpError(422, "La cantidad de ninos es invalida.");
  if (!data.documentNumber || !data.firstName || !data.lastName) throw new HttpError(422, "Documento, nombres y apellidos son obligatorios.");

  const room = await prisma.room.findUnique({ where: { id: roomId }, include: { type: true } });
  if (!room || room.status !== "LIBRE") throw notFound("Habitacion no disponible.");
  if (room.capacity < adults + children) throw new HttpError(422, "La habitacion no tiene capacidad suficiente para la reserva.");

  const totalPrice = money(room.price) * nights;
  let reservation;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      reservation = await prisma.$transaction(async (tx) => {
        const currentRoom = await tx.room.findUnique({ where: { id: roomId } });
        if (!currentRoom || currentRoom.status !== "LIBRE") throw notFound("Habitacion no disponible.");

        const conflict = await tx.reservation.findFirst({
          where: {
            roomId,
            status: { in: ["PENDIENTE", "CONFIRMADA", "CHECKED_IN"] },
            checkInDate: { lt: checkOutDate },
            checkOutDate: { gt: checkInDate }
          }
        });
        if (conflict) throw new HttpError(409, "La habitacion ya no esta disponible en ese rango de fechas.");

        const client = await tx.client.upsert({
          where: { documentNumber: String(data.documentNumber) },
          update: {
            documentType: data.documentType || "DNI",
            firstName: data.firstName,
            lastName: data.lastName,
            phone: data.phone || null,
            email: data.email || null,
            address: data.address || null,
            status: "ACTIVO"
          },
          create: {
            documentType: data.documentType || "DNI",
            documentNumber: String(data.documentNumber),
            firstName: data.firstName,
            lastName: data.lastName,
            phone: data.phone || null,
            email: data.email || null,
            address: data.address || null,
            status: "ACTIVO"
          }
        });

        const created = await tx.reservation.create({
          data: {
            code: reservationCode(),
            clientId: client.id,
            roomId,
            checkInDate,
            checkOutDate,
            adults,
            children,
            totalPrice,
            advance: 0,
            balance: totalPrice,
            status: "PENDIENTE",
            origin: "WEB",
            notes: data.notes || "Reserva solicitada desde portal publico."
          },
          include: { client: true, room: { include: { type: true } } }
        });

        await tx.room.update({ where: { id: roomId }, data: { status: "RESERVADA" } });
        return created;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      break;
    } catch (error) {
      if (retryableTransaction(error) && attempt < 2) continue;
      throw error;
    }
  }

  return publicReservation(reservation);
}
export async function getPublicReservation(code, documentNumber) {
  if (!code || !documentNumber) throw new HttpError(422, "Codigo y documento son obligatorios.");
  const reservation = await prisma.reservation.findFirst({
    where: { code, client: { documentNumber: String(documentNumber) } },
    include: { client: true, room: { include: { type: true } }, payments: true }
  });
  if (!reservation) throw notFound("Reserva no encontrada.");
  return publicReservation(reservation);
}
