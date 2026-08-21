import { Router } from "express";
import { basicIndex } from "../controllers/basic.controller.js";
import { authenticate, authorize } from "../middlewares/auth.js";

export function createBasicRoutes(resource, permissionModule, include = {}) {
  const router = Router();
  router.use(authenticate);
  router.get("/", authorize(`${permissionModule}:VER`), basicIndex(resource, include));
  return router;
}
