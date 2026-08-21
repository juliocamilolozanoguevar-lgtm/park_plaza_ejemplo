import { Router } from "express";
import * as controller from "../controllers/report.controller.js";
import { authenticate, authorize } from "../middlewares/auth.js";
import { cleaningUpload } from "../middlewares/upload.js";

export const reportRoutes = Router();

reportRoutes.use(authenticate);
reportRoutes.get("/", authorize("REPORTES:VER", "LIMPIEZA:VER", "RESTAURANTE:VER", "BARTENDER:VER", "MANTENIMIENTO:VER"), controller.index);
reportRoutes.get("/products", authorize("REPORTES:VER", "RESTAURANTE:VER", "BARTENDER:VER"), controller.products);
reportRoutes.post("/evidence/upload", authorize("REPORTES:CREAR", "MANTENIMIENTO:CREAR"), cleaningUpload.array("images", 8), controller.uploadEvidence);
reportRoutes.get("/:id", authorize("REPORTES:VER", "MANTENIMIENTO:VER"), controller.show);
reportRoutes.post("/", authorize("REPORTES:CREAR", "LIMPIEZA:CREAR", "RESTAURANTE:CREAR", "BARTENDER:CREAR", "MANTENIMIENTO:CREAR"), controller.store);
reportRoutes.patch("/:id/status", authorize("REPORTES:EDITAR", "MANTENIMIENTO:EDITAR"), controller.status);
reportRoutes.post("/:id/evidence", authorize("REPORTES:CREAR", "LIMPIEZA:CREAR", "RESTAURANTE:CREAR", "BARTENDER:CREAR", "MANTENIMIENTO:CREAR"), controller.evidence);
