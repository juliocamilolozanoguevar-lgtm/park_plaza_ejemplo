import { Router } from "express";
import * as controller from "../controllers/event.controller.js";
import { authenticate, authorize } from "../middlewares/auth.js";

export const eventRoutes = Router();

eventRoutes.use(authenticate);
eventRoutes.get("/", authorize("EVENTOS:VER"), controller.index);
eventRoutes.get("/spaces", authorize("EVENTOS:VER"), controller.spaces);
eventRoutes.get("/:id", authorize("EVENTOS:VER"), controller.show);
eventRoutes.post("/", authorize("EVENTOS:CREAR"), controller.store);
eventRoutes.put("/:id", authorize("EVENTOS:EDITAR"), controller.update);
eventRoutes.patch("/:id/status", authorize("EVENTOS:EDITAR"), controller.status);
eventRoutes.post("/:id/payments", authorize("PAGOS:CREAR"), controller.payment);
