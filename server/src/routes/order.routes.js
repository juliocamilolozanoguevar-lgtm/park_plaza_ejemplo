import { Router } from "express";
import * as controller from "../controllers/order.controller.js";
import { authenticate, authorize } from "../middlewares/auth.js";

export function createOrderRoutes(permissionModule, defaultArea) {
  const router = Router();
  router.use(authenticate);
  router.get("/", authorize(`${permissionModule}:VER`), controller.index(defaultArea));
  router.get("/:id", authorize(`${permissionModule}:VER`), controller.show);
  router.patch("/:id/status", authorize(`${permissionModule}:EDITAR`), controller.updateStatus);
  return router;
}
