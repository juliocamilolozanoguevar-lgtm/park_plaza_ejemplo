import { Router } from "express";
import * as controller from "../controllers/client-portal.controller.js";
import { authenticateClient } from "../middlewares/client-auth.js";

export const clientPortalRoutes = Router();

// Rutas públicas para clientes (login)
clientPortalRoutes.post("/session", controller.login);

// Rutas protegidas (requieren estadía ACTIVA)
const secure = Router();
secure.use(authenticateClient);

secure.get("/profile", controller.profile);
secure.get("/menu/:area", controller.menu);

secure.post("/orders", controller.createOrder);
secure.get("/orders", controller.listOrders);
secure.get("/orders/:id", controller.getOrderById);

secure.get("/consumptions", controller.listConsumptions);

secure.get("/events/spaces", controller.listEventSpaces);
secure.get("/events", controller.listEvents);
secure.get("/events/:id", controller.getEventById);
secure.post("/events", controller.createEvent);

secure.post("/pool", controller.createPoolAccess);

secure.post("/service-reservations", controller.createServiceReservation);
secure.get("/service-reservations", controller.listServiceReservations);
secure.get("/service-reservations/:id", controller.getServiceReservationById);
secure.patch("/service-reservations/:id/cancel", controller.cancelServiceReservation);

clientPortalRoutes.use("/", secure);
