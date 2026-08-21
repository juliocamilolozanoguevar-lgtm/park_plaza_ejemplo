import * as service from "../services/admin.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { audit } from "../utils/audit.js";

export const parking = asyncHandler(async (req, res) => res.json(await service.listParking()));
export const vehicleEntry = asyncHandler(async (req, res) => {
  const entry = await service.registerVehicleEntry(req.body);
  await audit(req, "COCHERA", "ENTRADA", entry.plate);
  res.status(201).json(entry);
});
export const vehicleExit = asyncHandler(async (req, res) => {
  const entry = await service.finishVehicleEntry(Number(req.params.id));
  await audit(req, "COCHERA", "SALIDA", entry.plate);
  res.json(entry);
});

export const suppliers = asyncHandler(async (req, res) => res.json(await service.listSuppliers()));
export const createSupplier = asyncHandler(async (req, res) => {
  const supplier = await service.createSupplier(req.body);
  await audit(req, "PROVEEDORES", "CREAR", supplier.name);
  res.status(201).json(supplier);
});
export const updateSupplier = asyncHandler(async (req, res) => {
  const supplier = await service.updateSupplier(Number(req.params.id), req.body);
  await audit(req, "PROVEEDORES", "EDITAR", supplier.name);
  res.json(supplier);
});

export const purchases = asyncHandler(async (req, res) => res.json(await service.listPurchases()));
export const createPurchase = asyncHandler(async (req, res) => {
  const purchase = await service.createPurchase(req.body, req.user?.id);
  await audit(req, "COMPRAS", "CREAR", `Compra ${purchase.id}`);
  res.status(201).json(purchase);
});
export const receivePurchase = asyncHandler(async (req, res) => {
  const purchase = await service.receivePurchase(Number(req.params.id), req.user?.id);
  await audit(req, "COMPRAS", "RECIBIR", `Compra ${purchase.id}`);
  res.json(purchase);
});

export const payments = asyncHandler(async (req, res) => res.json(await service.listPayments()));
export const createPayment = asyncHandler(async (req, res) => {
  const payment = await service.createPayment(req.body, req.user?.id);
  await audit(req, "PAGOS", "CREAR", payment.concept);
  res.status(201).json(payment);
});

export const invoices = asyncHandler(async (req, res) => res.json(await service.listInvoices()));
export const createInvoice = asyncHandler(async (req, res) => {
  const invoice = await service.createInvoice(req.body);
  await audit(req, "FACTURACION", "CREAR", `${invoice.series}-${invoice.number}`);
  res.status(201).json(invoice);
});

export const cash = asyncHandler(async (req, res) => res.json(await service.cashSummary()));
export const createCashMovement = asyncHandler(async (req, res) => {
  const movement = await service.createCashMovement(req.body, req.user?.id);
  await audit(req, "CAJA", movement.type, movement.concept);
  res.status(201).json(movement);
});

export const users = asyncHandler(async (req, res) => res.json(await service.listUsers()));
export const createUser = asyncHandler(async (req, res) => {
  const user = await service.createUser(req.body);
  await audit(req, "USUARIOS", "CREAR", user.email);
  res.status(201).json(user);
});
export const updateUser = asyncHandler(async (req, res) => {
  const previous = await service.getUser(Number(req.params.id));
  const user = await service.updateUser(Number(req.params.id), req.body);
  const action = auditUserAction(previous, user, req.body);
  await audit(req, "USUARIOS", action, user.email);
  res.json(user);
});

export const roles = asyncHandler(async (req, res) => res.json(await service.listRoles()));
export const permissions = asyncHandler(async (req, res) => res.json(await service.listPermissions()));
export const updateRolePermissions = asyncHandler(async (req, res) => {
  const role = await service.updateRolePermissions(Number(req.params.id), req.body.permissionIds || []);
  await audit(req, "ROLES_PERMISOS", "ACTUALIZAR", role.name);
  res.json(role);
});

export const settings = asyncHandler(async (req, res) => res.json(await service.listSettings()));
export const updateSettings = asyncHandler(async (req, res) => {
  const settings = await service.updateSettings(req.body);
  await audit(req, "CONFIGURACION", "EDITAR", settings.hotelName);
  res.json(settings);
});

function auditUserAction(previous, user, body) {
  if (previous?.roleId !== user.roleId) return "CAMBIAR_ROL";
  if (previous?.status !== user.status && user.status === "INACTIVO") return "DESACTIVAR";
  if (previous?.status !== user.status && user.status === "ACTIVO") return "REACTIVAR";
  if (body.password) return "RESTABLECER_ACCESO";
  return "EDITAR";
}
