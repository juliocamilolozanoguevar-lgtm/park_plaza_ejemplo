import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import { HttpError, notFound } from "../utils/httpError.js";

const includeMovement = {
  product: { include: { category: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
  inventoryLot: true
};

function statusFor(product) {
  const stock = Number(product.stock);
  const minStock = Number(product.minStock);
  if (stock === 0) return "SIN_STOCK";
  if (stock <= minStock) return "STOCK_BAJO";
  return "OK";
}

function hasValue(value) {
  return value !== undefined && value !== null && value !== "";
}

export function roundQty(value) {
  return new Prisma.Decimal(value || 0).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
}

export function roundMoney(value) {
  return new Prisma.Decimal(value || 0).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

function normalizeSupplierLotCode(value) {
  const text = String(value || "").trim();
  return text || null;
}

function normalizeDate(value) {
  if (!hasValue(value)) return null;
  return value instanceof Date ? value : new Date(value);
}

function sameDate(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return new Date(a).getTime() === new Date(b).getTime();
}

function isSerializableConflict(error) {
  return error?.code === "P2034" || error?.meta?.code === "40001";
}

export async function withInventoryEntryTransaction(operation) {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
      });
    } catch (error) {
      if (!isSerializableConflict(error) || attempt === maxAttempts) throw error;
    }
  }
  throw new HttpError(500, "No se pudo registrar la entrada.");
}

function assertUpdatedRows(result, message) {
  if (Number(result) === 0) throw new HttpError(422, message);
}

async function assertProductStockMatchesLots(tx, productId) {
  const [product, lots] = await Promise.all([
    tx.product.findUnique({ where: { id: productId } }),
    tx.inventoryLot.findMany({ where: { productId } })
  ]);
  const lotsSum = lots.reduce((sum, lot) => sum.plus(lot.currentQty), new Prisma.Decimal(0));
  if (!new Prisma.Decimal(product.stock).equals(lotsSum)) {
    throw new HttpError(500, "Invariante de inventario invalido: el stock no coincide con la suma de lotes.");
  }
}

async function ensureSupplier(tx, supplierId) {
  if (!supplierId) return null;
  const supplier = await tx.supplier.findUnique({ where: { id: Number(supplierId) } });
  if (!supplier) throw notFound("Proveedor no encontrado.");
  return supplier;
}

function internalEntryCode(id, date = new Date()) {
  return `ENT-${date.getFullYear()}-${String(id).padStart(6, "0")}`;
}

async function createManualLot(tx, { productId, supplierId, supplierLotCode, quantity, unitCost, expiresAt }) {
  const draft = await tx.inventoryLot.create({
    data: {
      productId,
      supplierId: supplierId || null,
      supplierLotCode: normalizeSupplierLotCode(supplierLotCode),
      code: `ENT-TMP-${randomUUID()}`,
      initialQty: quantity,
      currentQty: quantity,
      unitCost,
      expiresAt
    }
  });

  return tx.inventoryLot.update({
    where: { id: draft.id },
    data: { code: internalEntryCode(draft.id) }
  });
}

async function findReusableSupplierLot(tx, { supplierId, productId, supplierLotCode, expiresAt, unitCost }) {
  const normalizedCode = normalizeSupplierLotCode(supplierLotCode);
  if (!supplierId || !normalizedCode) return null;

  return tx.inventoryLot.findFirst({
    where: {
      supplierId: Number(supplierId),
      productId: Number(productId),
      supplierLotCode: normalizedCode,
      expiresAt,
      unitCost,
      active: true
    },
    orderBy: { id: "asc" }
  });
}

export async function resolvePurchaseLot(tx, purchase, item) {
  const quantity = roundQty(item.quantity);
  const unitCost = roundMoney(item.cost);
  const supplierLotCode = normalizeSupplierLotCode(item.supplierLotCode);
  const expiresAt = normalizeDate(item.expiresAt);

  if (quantity.lte(0)) throw new HttpError(422, "La cantidad recibida debe ser mayor a cero.");
  if (unitCost.lt(0)) throw new HttpError(422, "El costo no puede ser negativo.");

  const reusable = await findReusableSupplierLot(tx, {
    supplierId: purchase.supplierId,
    productId: item.productId,
    supplierLotCode,
    expiresAt,
    unitCost
  });

  if (reusable) return reusable;

  const lotCode = `LOT-P${purchase.id}-I${item.id}`;
  return tx.inventoryLot.create({
    data: {
      productId: item.productId,
      supplierId: purchase.supplierId,
      supplierLotCode,
      code: lotCode,
      initialQty: 0,
      currentQty: 0,
      unitCost,
      expiresAt,
      purchaseItemId: item.id
    }
  });
}

export async function recordInventoryEntry(tx, { productId, lotId, quantity, unitCost, type, origin, reason, reference, userId }) {
  const qty = roundQty(quantity);
  const cost = roundMoney(unitCost);
  if (qty.lte(0)) throw new HttpError(422, "La cantidad debe ser mayor a cero.");

  const [product, lot] = await Promise.all([
    tx.product.findUnique({ where: { id: Number(productId) }, include: { category: true } }),
    tx.inventoryLot.findUnique({ where: { id: Number(lotId) } })
  ]);

  if (!product) throw notFound("Producto no encontrado.");
  if (!lot) throw notFound("Lote no encontrado.");
  if (lot.productId !== product.id) throw new HttpError(422, "El lote no pertenece al producto indicado.");
  if (!lot.active) throw new HttpError(422, "El lote seleccionado esta inactivo.");

  const lotUpdate = await tx.$executeRaw`
    UPDATE "InventoryLot"
    SET "initialQty" = "initialQty" + ${qty},
        "currentQty" = "currentQty" + ${qty}
    WHERE id = ${lot.id}
    AND active = true
  `;
  assertUpdatedRows(lotUpdate, "No se pudo actualizar el lote de entrada.");

  const beforeQty = new Prisma.Decimal(product.stock);
  const productUpdate = await tx.$executeRaw`
    UPDATE "Product"
    SET stock = stock + ${qty},
        cost = ${cost}
    WHERE id = ${product.id}
  `;
  assertUpdatedRows(productUpdate, "No se pudo actualizar el stock del producto.");

  const updatedProduct = await tx.product.findUnique({ where: { id: product.id }, include: { category: true } });
  const afterQty = new Prisma.Decimal(updatedProduct.stock);

  const movement = await tx.inventoryMovement.create({
    data: {
      productId: product.id,
      inventoryLotId: lot.id,
      type,
      origin,
      quantity: qty,
      beforeQty,
      afterQty,
      unitCost: cost,
      reason,
      reference,
      createdById: userId || null
    },
    include: includeMovement
  });

  await assertProductStockMatchesLots(tx, product.id);

  const updatedLot = await tx.inventoryLot.findUnique({ where: { id: lot.id } });
  return { product: { ...updatedProduct, stockStatus: statusFor(updatedProduct) }, inventoryLot: updatedLot, movement, movements: [movement] };
}

function validateExistingLotCompatibility(lot, data) {
  const supplierLotCode = normalizeSupplierLotCode(data.supplierLotCode);
  const expiresAt = normalizeDate(data.expiresAt);
  const costInput = hasValue(data.unitCost) ? data.unitCost : data.cost;
  const unitCost = roundMoney(costInput);

  if (hasValue(costInput) && !new Prisma.Decimal(lot.unitCost).equals(unitCost)) {
    throw new HttpError(422, "El costo no coincide con el lote seleccionado.");
  }
  if (hasValue(data.expiresAt) && !sameDate(lot.expiresAt, expiresAt)) {
    throw new HttpError(422, "El vencimiento no coincide con el lote seleccionado.");
  }
  if (hasValue(data.supplierId) && Number(lot.supplierId || 0) !== Number(data.supplierId)) {
    throw new HttpError(422, "El proveedor no coincide con el lote seleccionado.");
  }
  if (supplierLotCode && lot.supplierLotCode && lot.supplierLotCode !== supplierLotCode) {
    throw new HttpError(422, "El codigo de lote proveedor no coincide con el lote seleccionado.");
  }
}

export async function registerInventoryEntry(data, userId) {
  const productId = Number(data.productId);
  const quantity = roundQty(data.quantity);
  const costInput = hasValue(data.unitCost) ? data.unitCost : data.cost;
  const unitCost = roundMoney(costInput);
  const reason = String(data.reason || "").trim();
  const expiresAt = normalizeDate(data.expiresAt);
  const supplierId = data.supplierId ? Number(data.supplierId) : null;

  if (!productId) throw new HttpError(422, "Selecciona un producto.");
  if (quantity.lte(0)) throw new HttpError(422, "La cantidad debe ser mayor a cero.");
  if (!reason) throw new HttpError(422, "Ingresa un motivo para la entrada.");
  if (!hasValue(costInput) || unitCost.lt(0)) throw new HttpError(422, "Ingresa un costo valido.");

  return withInventoryEntryTransaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: productId }, include: { category: true } });
    if (!product) throw notFound("Producto no encontrado.");
    await ensureSupplier(tx, supplierId);

    let lot;
    if (data.inventoryLotId) {
      lot = await tx.inventoryLot.findUnique({ where: { id: Number(data.inventoryLotId) } });
      if (!lot) throw notFound("Lote no encontrado.");
      validateExistingLotCompatibility(lot, data);
    } else {
      lot = await createManualLot(tx, {
        productId,
        supplierId,
        supplierLotCode: data.supplierLotCode,
        quantity: 0,
        unitCost,
        expiresAt
      });
    }

    return recordInventoryEntry(tx, {
      productId,
      lotId: lot.id,
      quantity,
      unitCost,
      type: "ENTRADA",
      origin: "ENTRADA_MANUAL",
      reason,
      reference: data.reference || "ENTRADA_MANUAL",
      userId
    });
  });
}
