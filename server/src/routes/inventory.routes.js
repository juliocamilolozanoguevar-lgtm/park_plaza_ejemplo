import { Router } from "express";
import * as controller from "../controllers/inventory.controller.js";
import { authenticate, authorize } from "../middlewares/auth.js";

export const inventoryRoutes = Router();
export const productRoutes = Router();

inventoryRoutes.use(authenticate);
inventoryRoutes.get("/", authorize("INVENTARIO:VER"), controller.index);
inventoryRoutes.get("/summary", authorize("INVENTARIO:VER"), controller.summary);
inventoryRoutes.get("/categories", authorize("INVENTARIO:VER"), controller.categories);
inventoryRoutes.get("/movements", authorize("INVENTARIO:VER"), controller.movements);
inventoryRoutes.get("/inspections", authorize("INVENTARIO:VER"), controller.inspections);
inventoryRoutes.get("/inspections/:id", authorize("INVENTARIO:VER"), controller.inspection);
inventoryRoutes.get("/lots", authorize("INVENTARIO:VER"), controller.lots);
inventoryRoutes.get("/lots/:id", authorize("INVENTARIO:VER"), controller.lot);
inventoryRoutes.post("/inspections", authorize("INVENTARIO:CREAR", "RESTAURANTE:CREAR", "BARTENDER:CREAR", "LIMPIEZA:CREAR", "MANTENIMIENTO:CREAR"), controller.retainForReview);
inventoryRoutes.patch("/inspections/:id/resolve", authorize("INVENTARIO:EDITAR"), controller.resolveInspection);
inventoryRoutes.post("/entries", authorize("INVENTARIO:CREAR"), controller.entry);
inventoryRoutes.post("/exits", authorize("INVENTARIO:CREAR"), controller.exit);
inventoryRoutes.post("/losses", authorize("INVENTARIO:CREAR", "RESTAURANTE:CREAR", "BARTENDER:CREAR"), controller.loss);
inventoryRoutes.post("/adjustments", authorize("INVENTARIO:CREAR"), controller.adjustment);

productRoutes.use(authenticate);
productRoutes.get("/", authorize("INVENTARIO:VER"), controller.index);
productRoutes.post("/", authorize("INVENTARIO:CREAR"), controller.storeProduct);
productRoutes.put("/:id", authorize("INVENTARIO:EDITAR"), controller.updateProduct);
productRoutes.delete("/:id", authorize("INVENTARIO:ELIMINAR"), controller.destroyProduct);
