import { Router } from "express";
import * as controller from "../controllers/production.controller.js";
import { authenticate, authorize } from "../middlewares/auth.js";

export const productionRoutes = Router();

productionRoutes.use(authenticate);
productionRoutes.get("/", authorize("INVENTARIO:VER", "RESTAURANTE:VER", "BARTENDER:VER"), controller.index);
productionRoutes.get("/summary", authorize("INVENTARIO:VER", "RESTAURANTE:VER", "BARTENDER:VER"), controller.summary);
productionRoutes.post("/", authorize("RESTAURANTE:CREAR", "BARTENDER:CREAR", "INVENTARIO:CREAR"), controller.store);
