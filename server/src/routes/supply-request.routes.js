import { Router } from "express";
import * as controller from "../controllers/supply-request.controller.js";
import { authenticate, authorize } from "../middlewares/auth.js";

export const supplyRequestRoutes = Router();

supplyRequestRoutes.use(authenticate);
supplyRequestRoutes.get("/", authorize("INVENTARIO:VER", "RESTAURANTE:VER", "BARTENDER:VER"), controller.index);
supplyRequestRoutes.post("/", authorize("RESTAURANTE:CREAR", "BARTENDER:CREAR", "INVENTARIO:CREAR"), controller.store);
supplyRequestRoutes.patch("/:id/status", authorize("INVENTARIO:EDITAR"), controller.status);
