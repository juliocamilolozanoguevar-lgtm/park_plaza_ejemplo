import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import { HttpError, notFound } from "../utils/httpError.js";
import { getAvailableLotsForProduct } from "./inventory-lot.service.js";

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

function roundQty(value) {
  return new Prisma.Decimal(value || 0).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
}

function isSerializableConflict(error) {
  return error?.code === "P2034" || error?.meta?.code === "40001";
}

async function withExitTransaction(operation) {
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
  throw new HttpError(500, "No se pudo registrar la salida.");
}

function assertUpdatedRows(result, message) {
  if (Number(result) === 0) throw new HttpError(422, message);
}

async function ensureUser(tx, userId) {
  if (!userId) return null;
  const user = await tx.user.findUnique({ where: { id: Number(userId) } });
  if (!user) throw new HttpError(422, "Usuario no autorizado.");
  return user;
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

async function resolveExplicitLot(tx, productId, inventoryLotId, quantity) {
  const lot = await tx.inventoryLot.findUnique({ where: { id: Number(inventoryLotId) } });
  if (!lot) throw notFound("Lote no encontrado.");
  if (lot.productId !== productId) throw new HttpError(422, "El lote no pertenece al producto indicado.");
  if (!lot.active) throw new HttpError(422, "El lote seleccionado no esta activo.");

  const available = new Prisma.Decimal(lot.currentQty);
  if (available.lt(quantity)) throw new HttpError(422, "Stock insuficiente en el lote seleccionado.");

  return [{ lot, quantity }];
}

async function resolveFefoLots(tx, productId, quantity) {
  const lots = await getAvailableLotsForProduct(productId, tx);
  const availableQty = lots.reduce((sum, lot) => sum.plus(lot.currentQty), new Prisma.Decimal(0));

  if (availableQty.lt(quantity)) {
    throw new HttpError(422, "Stock insuficiente por lotes para registrar la salida.", {
      productId,
      required: quantity.toFixed(4),
      available: availableQty.toFixed(4)
    });
  }

  let remaining = quantity;
  const allocations = [];

  for (const lot of lots) {
    if (remaining.lte(0)) break;
    const lotAvailable = new Prisma.Decimal(lot.currentQty);
    const qty = Prisma.Decimal.min(remaining, lotAvailable).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
    if (qty.gt(0)) {
      allocations.push({ lot, quantity: qty });
      remaining = remaining.minus(qty).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
    }
  }

  if (remaining.gt(0)) throw new HttpError(422, "Stock insuficiente por lotes para completar la salida.");
  return allocations;
}

export async function registerInventoryExit(data, userId) {
  const productId = Number(data.productId);
  const quantity = roundQty(data.quantity);
  const reason = String(data.reason || "").trim();
  const reference = String(data.reference || "").trim() || "SALIDA_MANUAL";

  if (!productId) throw new HttpError(422, "Selecciona un producto.");
  if (quantity.lte(0)) throw new HttpError(422, "La cantidad debe ser mayor a cero.");

  return withExitTransaction(async (tx) => {
    await ensureUser(tx, userId);

    const product = await tx.product.findUnique({ where: { id: productId }, include: { category: true } });
    if (!product) throw notFound("Producto no encontrado.");

    const beforeProductStock = new Prisma.Decimal(product.stock);
    if (beforeProductStock.lt(quantity)) throw new HttpError(422, "Stock insuficiente para registrar la salida.");

    const allocations = data.inventoryLotId
      ? await resolveExplicitLot(tx, productId, data.inventoryLotId, quantity)
      : await resolveFefoLots(tx, productId, quantity);

    const movements = [];

    for (const allocation of allocations) {
      const qty = roundQty(allocation.quantity);
      const lot = allocation.lot;

      const lotUpdate = await tx.$executeRaw`
        UPDATE "InventoryLot"
        SET "currentQty" = "currentQty" - ${qty}
        WHERE id = ${lot.id}
        AND active = true
        AND "currentQty" >= ${qty}
      `;
      assertUpdatedRows(lotUpdate, `El lote ${lot.code} no tiene stock suficiente.`);

      const productUpdate = await tx.$executeRaw`
        UPDATE "Product"
        SET stock = stock - ${qty}
        WHERE id = ${productId}
        AND stock >= ${qty}
      `;
      assertUpdatedRows(productUpdate, `El producto ${product.name} no tiene stock suficiente.`);

      const updatedProduct = await tx.product.findUnique({ where: { id: productId } });
      const afterQty = new Prisma.Decimal(updatedProduct.stock);
      const beforeQty = afterQty.plus(qty);

      const movement = await tx.inventoryMovement.create({
        data: {
          productId,
          inventoryLotId: lot.id,
          type: "SALIDA",
          origin: data.origin || "SALIDA_MANUAL",
          quantity: qty,
          beforeQty,
          afterQty,
          unitCost: lot.unitCost,
          reason: reason || null,
          reference,
          createdById: userId || null
        },
        include: includeMovement
      });

      movements.push(movement);
    }

    const updated = await tx.product.findUnique({ where: { id: productId }, include: { category: true } });
    await assertProductStockMatchesLots(tx, productId);

    return { product: { ...updated, stockStatus: statusFor(updated) }, movement: movements[0], movements };
  });
}
