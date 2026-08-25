import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "./config/env.js";
import { prisma } from "./config/prisma.js";

let io;

export function initializeSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: env.frontendUrls,
      credentials: true
    }
  });

  /**
   * Middleware de autenticacion Socket.IO
   *
   * El token debe venir en socket.handshake.auth.token
   * Nunca confiamos en stayId/clientId enviados desde el cliente.
   * El room al que se une el socket se deriva del token + DB.
   *
   * Scopes:
   *   payload.role === "CLIENT"    → huesped con Stay activa → room stay_{stayId}
   *   payload.scope === "CUSTOMER" → cliente externo         → room client_{clientId}
   *   cualquier otro token         → staff, sin room cliente
   */
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(new Error("Autenticacion requerida para Socket.IO"));
      }

      let payload;
      try {
        payload = jwt.verify(token, env.jwtSecret);
      } catch {
        return next(new Error("Token invalido o expirado"));
      }

      // HUESPED (CLIENT con Stay activa)
      if (payload.role === "CLIENT") {
        if (!payload.stayId || !payload.clientId) {
          return next(new Error("Token de huesped invalido: faltan stayId o clientId"));
        }
        const stay = await prisma.stay.findUnique({
          where: { id: Number(payload.stayId) },
          select: { id: true, status: true, clientId: true }
        });
        if (!stay || stay.status !== "ACTIVA" || stay.clientId !== Number(payload.clientId)) {
          return next(new Error("Estadia invalida o inactiva"));
        }
        socket.clientData = { scope: "CLIENT", stayId: stay.id, clientId: stay.clientId };
        socket.join(`stay_${stay.id}`);
        return next();
      }

      // CLIENTE EXTERNO (CUSTOMER sin Stay)
      if (payload.scope === "CUSTOMER") {
        if (!payload.clientId) {
          return next(new Error("Token de cliente externo invalido: falta clientId"));
        }
        const client = await prisma.client.findUnique({
          where: { id: Number(payload.clientId) },
          select: { id: true, status: true }
        });
        if (!client || client.status !== "ACTIVO") {
          return next(new Error("Cliente externo no autorizado o inactivo"));
        }
        socket.clientData = { scope: "CUSTOMER", clientId: client.id };
        socket.join(`client_${client.id}`);
        return next();
      }

      // Staff / Admin — puede conectarse sin room de cliente
      socket.clientData = { scope: "STAFF" };
      return next();
    } catch (err) {
      next(new Error("Error interno de autenticacion de socket"));
    }
  });

  io.on("connection", (socket) => {
    const scope = socket.clientData?.scope || "Desconocido";
    console.log(`Socket conectado: ${socket.id} (scope: ${scope})`);
    socket.on("disconnect", () => {
      console.log(`Socket desconectado: ${socket.id}`);
    });
  });

  return io;
}

export function getIO() {
  if (!io) throw new Error("Socket.IO no ha sido inicializado");
  return io;
}

/** Emite a una Stay especifica de huesped */
export function emitToStay(stayId, event, data) {
  if (io) io.to(`stay_${stayId}`).emit(event, data);
}

/** Emite a un cliente externo especifico */
export function emitToClient(clientId, event, data) {
  if (io) io.to(`client_${clientId}`).emit(event, data);
}
