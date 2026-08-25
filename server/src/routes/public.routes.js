import { Router } from "express";
import * as controller from "../controllers/public.controller.js";

export const publicRoutes = Router();

publicRoutes.get("/hotel", controller.hotel);
publicRoutes.get("/room-types", controller.roomTypes);
publicRoutes.get("/rooms/available", controller.availableRooms);
publicRoutes.post("/clients", controller.createClient);
publicRoutes.post("/reservations", controller.createReservation);
publicRoutes.get("/reservations/recover", controller.recoverReservations);
publicRoutes.get("/reservations/:code", controller.showReservation);
publicRoutes.get("/events/spaces", controller.eventSpaces);
publicRoutes.post("/events", controller.createEvent);

publicRoutes.get("/services", controller.listServices);
publicRoutes.get("/services/:type/availability", controller.serviceAvailability);
publicRoutes.get("/services/:type/plans", controller.servicePlans);
publicRoutes.get("/services/:type/extras", controller.serviceExtras);
