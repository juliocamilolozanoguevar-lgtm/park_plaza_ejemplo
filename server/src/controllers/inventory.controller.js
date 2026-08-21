import * as service from "../services/inventory.service.js";
import * as lotService from "../services/inventory-lot.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { audit } from "../utils/audit.js";

export const index = asyncHandler(async (req, res) => {
  res.json(await service.listProducts(req.query));
});

export const summary = asyncHandler(async (req, res) => {
  res.json(await service.inventorySummary(req.query));
});

export const categories = asyncHandler(async (req, res) => {
  res.json(await service.listCategories());
});

export const movements = asyncHandler(async (req, res) => {
  res.json(await service.listMovements(req.query));
});

export const lots = asyncHandler(async (req, res) => {
  res.json(await lotService.listLots(req.query));
});

export const lot = asyncHandler(async (req, res) => {
  res.json(await lotService.getLot(req.params.id));
});

export const entry = asyncHandler(async (req, res) => {
  const result = await service.registerMovement("ENTRADA", {
    ...req.body,
    origin: "ENTRADA_MANUAL",
    reference: req.body.reference || "ENTRADA_MANUAL"
  }, req.user?.id);
  await audit(req, "INVENTARIO", "ENTRADA", result.product.name);
  res.status(201).json(result);
});

export const exit = asyncHandler(async (req, res) => {
  const result = await service.registerMovement("SALIDA", {
    ...req.body,
    origin: "SALIDA_MANUAL",
    reference: req.body.reference || "SALIDA_MANUAL"
  }, req.user?.id);
  await audit(req, "INVENTARIO", "SALIDA", result.product.name);
  res.status(201).json(result);
});

export const loss = asyncHandler(async (req, res) => {
  const result = await service.registerMovement("SALIDA", {
    ...req.body,
    origin: "PERDIDA",
    reason: `Perdida extraordinaria: ${req.body.reason || "Sin motivo"}`,
    reference: req.body.reference || "PERDIDA_OPERATIVA"
  }, req.user?.id);
  await audit(req, "INVENTARIO", "PERDIDA_OPERATIVA", result.product.name);
  res.status(201).json(result);
});

export const adjustment = asyncHandler(async (req, res) => {
  const result = await service.registerMovement("AJUSTE", {
    ...req.body,
    origin: "AJUSTE_MANUAL",
    reference: req.body.reference || "AJUSTE_MANUAL"
  }, req.user?.id);
  await audit(req, "INVENTARIO", "AJUSTE", result.product.name);
  res.status(201).json(result);
});

export const storeProduct = asyncHandler(async (req, res) => {
  const product = await service.createProduct(req.body);
  await audit(req, "INVENTARIO", "CREAR_PRODUCTO", product.name);
  res.status(201).json(product);
});

export const updateProduct = asyncHandler(async (req, res) => {
  const product = await service.updateProduct(Number(req.params.id), req.body);
  await audit(req, "INVENTARIO", "EDITAR_PRODUCTO", product.name);
  res.json(product);
});

export const destroyProduct = asyncHandler(async (req, res) => {
  const product = await service.deactivateProduct(Number(req.params.id));
  await audit(req, "INVENTARIO", "DESACTIVAR_PRODUCTO", product.name);
  res.json(product);
});
