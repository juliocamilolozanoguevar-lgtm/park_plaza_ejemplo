import { Router } from "express";
import * as controller from "../controllers/attendance.controller.js";
import { authenticate, authorize } from "../middlewares/auth.js";

export const attendanceRoutes = Router();

attendanceRoutes.post("/mark", controller.mark);
attendanceRoutes.use(authenticate);
attendanceRoutes.get("/summary", authorize("ASISTENCIA:VER"), controller.summary);
attendanceRoutes.get("/today", authorize("ASISTENCIA:VER"), controller.today);
attendanceRoutes.get("/history", authorize("ASISTENCIA:VER"), controller.history);
attendanceRoutes.get("/:id", authorize("ASISTENCIA:VER"), controller.detail);
attendanceRoutes.patch("/:id/correct", authorize("ASISTENCIA:EDITAR"), controller.correct);
