import { Router } from "express";
import * as controller from "../controllers/client.controller.js";
import { authenticate, authorize } from "../middlewares/auth.js";
import { validate } from "../validators/common.js";
import { clientSchema } from "../validators/schemas.js";

export const clientRoutes = Router();

clientRoutes.use(authenticate);
clientRoutes.get("/", authorize("CLIENTES:VER"), controller.index);
clientRoutes.get("/search", authorize("CLIENTES:VER"), controller.search);
clientRoutes.get("/:id", authorize("CLIENTES:VER"), controller.show);
clientRoutes.post("/", authorize("CLIENTES:CREAR"), validate(clientSchema), controller.store);
clientRoutes.put("/:id", authorize("CLIENTES:EDITAR"), validate(clientSchema), controller.update);
clientRoutes.delete("/:id", authorize("CLIENTES:ELIMINAR"), controller.destroy);
