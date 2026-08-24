import { Router } from "express";
import * as controller from "../controllers/reservation.controller.js";
import { authenticate, authorize } from "../middlewares/auth.js";
import { validate } from "../validators/common.js";
import { reservationSchema } from "../validators/schemas.js";

export const reservationRoutes = Router();

reservationRoutes.use(authenticate);
reservationRoutes.get("/", authorize("RESERVAS:VER"), controller.index);
reservationRoutes.get("/:id", authorize("RESERVAS:VER"), controller.show);
reservationRoutes.post("/", authorize("RESERVAS:CREAR"), validate(reservationSchema), controller.store);
reservationRoutes.put("/:id", authorize("RESERVAS:EDITAR"), controller.update);
reservationRoutes.post("/:id/payments", authorize("RESERVAS:EDITAR", "PAGOS:CREAR"), controller.confirmPayment);
reservationRoutes.post("/:id/cash-payment", authorize("RESERVAS:EDITAR", "PAGOS:CREAR"), controller.confirmCashPayment);
reservationRoutes.delete("/:id", authorize("RESERVAS:ELIMINAR"), controller.destroy);
