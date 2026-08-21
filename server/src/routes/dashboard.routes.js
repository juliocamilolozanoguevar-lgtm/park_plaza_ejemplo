import { Router } from "express";
import * as controller from "../controllers/dashboard.controller.js";
import { authenticate, authorize } from "../middlewares/auth.js";

export const dashboardRoutes = Router();

dashboardRoutes.get("/", authenticate, authorize("DASHBOARD:VER"), controller.dashboard);
