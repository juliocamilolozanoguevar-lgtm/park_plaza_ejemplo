import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "./config/env.js";

let io;

export function initializeSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: env.frontendUrls,
      credentials: true
    }
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Autenticación requerida para Socket.IO"));

      const payload = jwt.verify(token, env.jwtSecret);
      
      // If it's a client, join a room for their specific stay
      if (payload.role === "CLIENT") {
        socket.clientData = payload;
        socket.join(`stay_${payload.stayId}`);
      }

      next();
    } catch (err) {
      next(new Error("Token inválido"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`Socket conectado: ${socket.id} (Rol: ${socket.clientData?.role || 'Desconocido'})`);
    
    socket.on("disconnect", () => {
      console.log(`Socket desconectado: ${socket.id}`);
    });
  });

  return io;
}

export function getIO() {
  if (!io) {
    throw new Error("Socket.IO no ha sido inicializado");
  }
  return io;
}

// Función auxiliar para emitir a clientes específicos
export function emitToStay(stayId, event, data) {
  if (io) {
    io.to(`stay_${stayId}`).emit(event, data);
  }
}
