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

function roundQty(value) {
  return new Prisma.Decimal(value || 0).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
}

function isSerializableConflict(error) {
  return error?.code === "P2034" || error?.meta?.code === "40001";
}

async function withAdjustmentTransaction(operation) {
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
  throw new HttpError(500, "No se pudo registrar el ajuste.");
}

function assertUpdatedRows(result, error) {
  if (Number(result) === 0) throw error;
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

export async function registerInventoryAdjustment(data, userId) {
  const productId = Number(data.productId);
  const inventoryLotId = Number(data.inventoryLotId);
  const countedInput = hasValue(data.countedQty) ? data.countedQty : data.quantity;
  const reason = String(data.reason || "").trim();

  if (!productId) throw new HttpError(422, "Selecciona un producto.");
  if (!inventoryLotId) throw new HttpError(422, "Selecciona el lote a ajustar.");
  if (!hasValue(countedInput)) throw new HttpError(422, "Ingresa el stock fisico contado.");
  if (!hasValue(data.expectedLotQty)) throw new HttpError(422, "Falta el stock esperado del lote.");
  if (!reason) throw new HttpError(422, "Ingresa un motivo para el ajuste.");

  const countedQty = roundQty(countedInput);
  const expectedLotQty = roundQty(data.expectedLotQty);

  if (countedQty.lt(0)) throw new HttpError(422, "El stock fisico contado no puede ser negativo.");
  if (expectedLotQty.lt(0)) throw new HttpError(422, "El stock esperado del lote no puede ser negativo.");

  return withAdjustmentTransaction(async (tx) => {
    const [product, lot] = await Promise.all([
      tx.product.findUnique({ where: { id: productId }, include: { category: true } }),
      tx.inventoryLot.findUnique({ where: { id: inventoryLotId } })
    ]);

    if (!product) throw notFound("Producto no encontrado.");
    if (!lot) throw notFound("Lote no encontrado.");
    if (lot.productId !== productId) throw new HttpError(422, "El lote no pertenece al producto indicado.");
    if (!lot.active) throw new HttpError(422, "El lote seleccionado esta inactivo y no puede ajustarse.");

    const currentLotQty = roundQty(lot.currentQty);
    if (!currentLotQty.equals(expectedLotQty)) {
      throw new HttpError(409, "El lote cambio desde que fue consultado. Actualiza la informacion antes de guardar el ajuste.");
    }

    const difference = countedQty.minus(currentLotQty).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
    if (difference.equals(0)) {
      return {
        product: { ...product, stockStatus: statusFor(product) },
        inventoryLot: lot,
        movement: null,
        movements: [],
        noChange: true,
        difference
      };
    }

    const lotUpdate = await tx.$executeRaw`
      UPDATE "InventoryLot"
      SET "currentQty" = ${countedQty}
      WHERE id = ${inventoryLotId}
      AND "currentQty" = ${expectedLotQty}
    `;
    assertUpdatedRows(
      lotUpdate,
      new HttpError(409, "El lote cambio desde que fue consultado. Actualiza la informacion antes de guardar el ajuste.")
    );

    const beforeQty = new Prisma.Decimal(product.stock);
    const absDifference = difference.abs().toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
    let productUpdate;

    if (difference.gt(0)) {
      productUpdate = await tx.$executeRaw`
        UPDATE "Product"
        SET stock = stock + ${difference}
        WHERE id = ${productId}
      `;
    } else {
      productUpdate = await tx.$executeRaw`
        UPDATE "Product"
        SET stock = stock - ${absDifference}
        WHERE id = ${productId}
        AND stock >= ${absDifference}
      `;
    }

    assertUpdatedRows(productUpdate, new HttpError(422, "No se permite stock negativo."));

    const updatedProduct = await tx.product.findUnique({ where: { id: productId }, include: { category: true } });
    const afterQty = new Prisma.Decimal(updatedProduct.stock);

    const movement = await tx.inventoryMovement.create({
      data: {
        productId,
        inventoryLotId,
        type: "AJUSTE",
        origin: "AJUSTE_MANUAL",
        quantity: absDifference,
        beforeQty,
        afterQty,
        unitCost: lot.unitCost,
        reason,
        reference: data.reference || "AJUSTE_MANUAL",
        createdById: userId || null
      },
      include: includeMovement
    });

    await assertProductStockMatchesLots(tx, productId);

    const updatedLot = await tx.inventoryLot.findUnique({ where: { id: inventoryLotId } });
    return {
      product: { ...updatedProduct, stockStatus: statusFor(updatedProduct) },
      inventoryLot: updatedLot,
      movement,
      movements: [movement],
      noChange: false,
      difference
    };
  });
}
