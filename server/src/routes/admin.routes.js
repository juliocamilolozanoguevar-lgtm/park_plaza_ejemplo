import { Router } from "express";
import * as controller from "../controllers/admin.controller.js";
import { authenticate, authorize } from "../middlewares/auth.js";

export const parkingRoutes = Router();
parkingRoutes.use(authenticate);
parkingRoutes.get("/", authorize("COCHERA:VER"), controller.parking);
parkingRoutes.post("/entries", authorize("COCHERA:CREAR"), controller.vehicleEntry);
parkingRoutes.patch("/entries/:id/finish", authorize("COCHERA:EDITAR"), controller.vehicleExit);

export const supplierRoutes = Router();
supplierRoutes.use(authenticate);
supplierRoutes.get("/", authorize("PROVEEDORES:VER"), controller.suppliers);
supplierRoutes.post("/", authorize("PROVEEDORES:CREAR"), controller.createSupplier);
supplierRoutes.put("/:id", authorize("PROVEEDORES:EDITAR"), controller.updateSupplier);

export const purchaseRoutes = Router();
purchaseRoutes.use(authenticate);
purchaseRoutes.get("/", authorize("COMPRAS:VER"), controller.purchases);
purchaseRoutes.post("/", authorize("COMPRAS:CREAR"), controller.createPurchase);
purchaseRoutes.patch("/:id/receive", authorize("COMPRAS:EDITAR"), controller.receivePurchase);

export const paymentRoutes = Router();
paymentRoutes.use(authenticate);
paymentRoutes.get("/", authorize("PAGOS:VER"), controller.payments);
paymentRoutes.post("/", authorize("PAGOS:CREAR"), controller.createPayment);

export const invoiceRoutes = Router();
invoiceRoutes.use(authenticate);
invoiceRoutes.get("/", authorize("FACTURACION:VER"), controller.invoices);
invoiceRoutes.post("/", authorize("FACTURACION:CREAR"), controller.createInvoice);

export const cashRoutes = Router();
cashRoutes.use(authenticate);
cashRoutes.get("/", authorize("CAJA:VER"), controller.cash);
cashRoutes.post("/movements", authorize("CAJA:CREAR"), controller.createCashMovement);

export const userRoutes = Router();
userRoutes.use(authenticate);
userRoutes.get("/", authorize("USUARIOS:VER"), controller.users);
userRoutes.post("/", authorize("USUARIOS:CREAR"), controller.createUser);
userRoutes.put("/:id", authorize("USUARIOS:EDITAR"), controller.updateUser);

export const roleRoutes = Router();
roleRoutes.use(authenticate);
roleRoutes.get("/", authorize("ROLES:VER"), controller.roles);
roleRoutes.get("/permissions", authorize("ROLES:VER"), controller.permissions);
roleRoutes.put("/:id/permissions", authorize("ROLES:EDITAR"), controller.updateRolePermissions);

export const settingRoutes = Router();
settingRoutes.use(authenticate);
settingRoutes.get("/", authorize("CONFIGURACION:VER"), controller.settings);
settingRoutes.put("/", authorize("CONFIGURACION:EDITAR"), controller.updateSettings);
