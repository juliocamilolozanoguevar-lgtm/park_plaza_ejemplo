import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { HttpError } from "../utils/httpError.js";

export async function authenticateClient(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      throw new HttpError(401, "Token requerido.");
    }

    const payload = jwt.verify(token, env.jwtSecret);
    
    if (payload.role !== "CLIENT") {
      throw new HttpError(401, "Token invalido para acceso de cliente.");
    }

    const stay = await prisma.stay.findUnique({
      where: { id: Number(payload.stayId) },
      include: {
        client: true,
        reservation: true
      }
    });

    if (!stay || stay.status !== "ACTIVA") {
      throw new HttpError(401, "La estadía ya no se encuentra activa.");
    }
    if (stay.clientId !== Number(payload.clientId)) {
      throw new HttpError(401, "Token invalido para la estadia.");
    }

    const client = stay.client;
    if (!client || (client.status !== "ACTIVO" && client.status !== "HOSPEDADO")) {
      throw new HttpError(401, "Cliente no autorizado o inactivo.");
    }

    if (
      !stay.reservation ||
      stay.reservation.id !== stay.reservationId ||
      stay.reservation.clientId !== stay.clientId ||
      stay.reservation.roomId !== stay.roomId
    ) {
      throw new HttpError(401, "Relacion de estadia invalida.");
    }

    req.client = {
      id: client.id,
      documentNumber: client.documentNumber,
      firstName: client.firstName,
      lastName: client.lastName,
      reservationId: stay.reservationId,
      stayId: stay.id,
      roomId: stay.roomId
    };

    next();
  } catch (error) {
    next(error.status ? error : new HttpError(401, "Token invalido o expirado."));
  }
}
