import { Router } from "express";
import * as controller from "../controllers/customer-events.controller.js";
import { authenticateCustomer } from "../middlewares/auth.js";

export const customerEventsRoutes = Router();

// Middleware de autenticación B2C (protección por token de cliente)
customerEventsRoutes.use(authenticateCustomer);

customerEventsRoutes.get("/", controller.getMyEvents);
// endpoint futuro: customerEventsRoutes.get("/:id", controller.showEvent);
customerEventsRoutes.post("/:id/accept", controller.acceptQuotation);
