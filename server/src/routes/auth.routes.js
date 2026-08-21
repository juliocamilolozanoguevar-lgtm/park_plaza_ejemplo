import { Router } from "express";
import * as controller from "../controllers/auth.controller.js";
import { authenticate } from "../middlewares/auth.js";
import { validate } from "../validators/common.js";
import { loginSchema } from "../validators/schemas.js";

export const authRoutes = Router();

authRoutes.post("/login", validate(loginSchema), controller.login);
authRoutes.get("/me", authenticate, controller.me);
