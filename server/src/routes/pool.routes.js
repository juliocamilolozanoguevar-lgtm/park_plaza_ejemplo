import { Router } from "express";
import * as controller from "../controllers/pool.controller.js";
import { authenticate, authorize } from "../middlewares/auth.js";

export const poolRoutes = Router();

poolRoutes.use(authenticate);
poolRoutes.get("/", authorize("PISCINA:VER"), controller.index);
poolRoutes.get("/client-search", authorize("PISCINA:VER"), controller.searchClients);
poolRoutes.post("/", authorize("PISCINA:CREAR"), controller.store);
poolRoutes.patch("/:id/finish", authorize("PISCINA:EDITAR"), controller.finish);
poolRoutes.get("/reports", authorize("PISCINA:VER"), controller.reports);
poolRoutes.post("/reports", authorize("PISCINA:CREAR"), controller.storeReport);
