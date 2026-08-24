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

    const client = await prisma.client.findUnique({
      where: { id: payload.clientId }
    });

    // Permitimos ACTIVO o HOSPEDADO
    if (!client || (client.status !== "ACTIVO" && client.status !== "HOSPEDADO")) {
      throw new HttpError(401, "Cliente no autorizado o inactivo.");
    }

    // Validar que la estadía del token siga activa
    const stay = await prisma.stay.findUnique({
      where: { id: payload.stayId }
    });

    if (!stay || stay.status !== "ACTIVA") {
      throw new HttpError(401, "La estadía ya no se encuentra activa.");
    }

    req.client = {
      id: client.id,
      documentNumber: client.documentNumber,
      firstName: client.firstName,
      lastName: client.lastName,
      reservationId: payload.reservationId,
      stayId: payload.stayId,
      roomId: payload.roomId
    };

    next();
  } catch (error) {
    next(error.status ? error : new HttpError(401, "Token invalido o expirado."));
  }
}
