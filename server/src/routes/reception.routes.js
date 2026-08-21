import { Router } from "express";
import * as controller from "../controllers/reception.controller.js";
import { authenticate, authorize } from "../middlewares/auth.js";
import { validate } from "../validators/common.js";
import { checkInSchema, checkOutSchema } from "../validators/schemas.js";

export const checkInRoutes = Router();
export const checkOutRoutes = Router();

checkInRoutes.use(authenticate);
checkInRoutes.get("/search", authorize("CHECK_IN:VER"), controller.searchReservations);
checkInRoutes.post("/", authorize("CHECK_IN:CREAR"), validate(checkInSchema), controller.checkIn);

checkOutRoutes.use(authenticate);
checkOutRoutes.get("/stays", authorize("CHECK_OUT:VER"), controller.activeStays);
checkOutRoutes.post("/", authorize("CHECK_OUT:CREAR"), validate(checkOutSchema), controller.checkOut);
