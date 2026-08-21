import { Router } from "express";
import * as controller from "../controllers/room.controller.js";
import { authenticate, authorize } from "../middlewares/auth.js";
import { validate } from "../validators/common.js";
import { roomSchema } from "../validators/schemas.js";

export const roomRoutes = Router();

roomRoutes.use(authenticate);
roomRoutes.get("/", authorize("HABITACIONES:VER"), controller.index);
roomRoutes.get("/types", authorize("HABITACIONES:VER"), controller.types);
roomRoutes.get("/:id/availability", authorize("HABITACIONES:VER"), controller.availability);
roomRoutes.get("/:id/check-availability", authorize("HABITACIONES:VER"), controller.checkAvailability);
roomRoutes.get("/:id", authorize("HABITACIONES:VER"), controller.show);
roomRoutes.post("/", authorize("HABITACIONES:CREAR"), validate(roomSchema), controller.store);
roomRoutes.put("/:id", authorize("HABITACIONES:EDITAR"), validate(roomSchema), controller.update);
roomRoutes.delete("/:id", authorize("HABITACIONES:ELIMINAR"), controller.destroy);
