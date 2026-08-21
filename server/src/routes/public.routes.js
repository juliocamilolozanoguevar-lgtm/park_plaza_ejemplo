import { Router } from "express";
import * as controller from "../controllers/public.controller.js";

export const publicRoutes = Router();

publicRoutes.get("/hotel", controller.hotel);
publicRoutes.get("/room-types", controller.roomTypes);
publicRoutes.get("/rooms/available", controller.availableRooms);
publicRoutes.post("/reservations", controller.createReservation);
publicRoutes.get("/reservations/:code", controller.showReservation);