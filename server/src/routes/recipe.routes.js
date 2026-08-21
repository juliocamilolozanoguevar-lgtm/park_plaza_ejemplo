import { Router } from "express";
import * as controller from "../controllers/recipe.controller.js";
import { authenticate, authorize } from "../middlewares/auth.js";

export const recipeRoutes = Router();

recipeRoutes.use(authenticate);
recipeRoutes.get("/", authorize("INVENTARIO:VER", "RESTAURANTE:VER", "BARTENDER:VER"), controller.index);
recipeRoutes.post("/", authorize("INVENTARIO:CREAR"), controller.store);
recipeRoutes.put("/:id", authorize("INVENTARIO:EDITAR"), controller.update);
recipeRoutes.patch("/:id/active", authorize("INVENTARIO:EDITAR"), controller.active);
