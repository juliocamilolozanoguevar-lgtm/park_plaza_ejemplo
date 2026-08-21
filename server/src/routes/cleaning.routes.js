import { Router } from "express";
import * as controller from "../controllers/cleaning.controller.js";
import { authenticate, authorize } from "../middlewares/auth.js";
import { cleaningUpload } from "../middlewares/upload.js";

export const cleaningRoutes = Router();

cleaningRoutes.use(authenticate);
cleaningRoutes.get("/", authorize("LIMPIEZA:VER"), controller.index);
cleaningRoutes.get("/tasks", authorize("LIMPIEZA:VER"), controller.index);
cleaningRoutes.post("/evidence/upload", authorize("LIMPIEZA:CREAR"), cleaningUpload.array("images", 8), controller.uploadEvidence);
cleaningRoutes.patch("/:id", authorize("LIMPIEZA:EDITAR"), controller.update);
cleaningRoutes.patch("/tasks/:id/start", authorize("LIMPIEZA:EDITAR"), controller.start);
cleaningRoutes.patch("/tasks/:id/finish", authorize("LIMPIEZA:EDITAR"), controller.finish);
cleaningRoutes.post("/tasks/:id/evidence", authorize("LIMPIEZA:CREAR"), controller.storeEvidence);
cleaningRoutes.post("/tasks/:id/report", authorize("LIMPIEZA:CREAR"), controller.storeTaskReport);
cleaningRoutes.post("/:id/evidences", authorize("LIMPIEZA:CREAR"), controller.storeEvidence);
cleaningRoutes.get("/reports", authorize("LIMPIEZA:VER"), controller.reports);
cleaningRoutes.post("/reports", authorize("LIMPIEZA:CREAR"), controller.storeReport);
