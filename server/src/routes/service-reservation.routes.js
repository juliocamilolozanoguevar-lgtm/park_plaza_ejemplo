import { Router } from "express";
import * as controller from "../controllers/service-reservation.controller.js";
import { authenticate, authorize } from "../middlewares/auth.js";

export const serviceReservationRoutes = Router();

serviceReservationRoutes.use(authenticate);
serviceReservationRoutes.post("/:id/check-in", authorize("RECEPCION:EDITAR"), controller.checkInMirador);
serviceReservationRoutes.patch("/:id/complete", authorize("RECEPCION:EDITAR"), controller.completeMirador);
