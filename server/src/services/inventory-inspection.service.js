import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import { HttpError, notFound } from "../utils/httpError.js";

const allowedAreas = new Set(["RESTAURANTE", "BARTENDER", "LIMPIEZA", "MANTENIMIENTO"]);
const allowedResolutionStatuses = new Set(["APTO", "NO_APTO"]);

const includeInspection = {
  product: { include: { category: true } },
  inventoryLot: true,
  createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
  resolvedBy: { select: { id: true, firstName: true, lastName: true, email: true } }
};

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

async function withInspectionTransaction(operation) {
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
  throw new HttpError(500, "No se pudo registrar el producto retenido.");
}

function assertUpdatedRows(result, message) {
  if (Number(result) === 0) throw new HttpError(422, message);
}

async function ensureUser(tx, userId) {
  if (!userId) return null;
  const user = await tx.user.findUnique({ where: { id: Number(userId) } });
  if (!user || user.status !== "ACTIVO") throw new HttpError(401, "Usuario no autorizado.");
  return user;
}

async function assertProductStockMatchesLots(tx, productId) {
  const [product, lots] = await Promise.all([
    tx.product.findUnique({ where: { id: productId } }),
    tx.inventoryLot.findMany({ where: { productId } })
  ]);
  const lotsSum = lots.reduce((sum, lot) => sum.plus(lot.currentQty), new Prisma.Decimal(0));
  if (!new Prisma.Decimal(product.stock).equals(lotsSum)) {
    throw new HttpError(500, "Invariante de inventario invalido: el stock no coincide con la suma de lotes disponibles.");
  }
}

async function controlledPhysicalStock(tx, productId) {
  const [product, pending] = await Promise.all([
    tx.product.findUnique({ where: { id: Number(productId) } }),
    tx.inventoryInspection.findMany({
      where: { productId: Number(productId), status: "PENDIENTE" },
      select: { quantity: true }
    })
  ]);
  const pendingQty = pending.reduce((sum, item) => sum.plus(item.quantity), new Prisma.Decimal(0));
  return {
    availableQty: new Prisma.Decimal(product?.stock || 0),
    pendingQty,
    physicalQty: new Prisma.Decimal(product?.stock || 0).plus(pendingQty).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP)
  };
}

function mapInspection(inspection, stock = null) {
  return {
    ...inspection,
    stock
  };
}

export async function listInspections(query = {}) {
  const where = {
    status: query.status || undefined,
    area: query.area || undefined,
    productId: query.productId ? Number(query.productId) : undefined
  };

  if (query.from || query.to) {
    where.createdAt = {};
    if (query.from) where.createdAt.gte = new Date(query.from);
    if (query.to) where.createdAt.lte = new Date(query.to);
  }

  const inspections = await prisma.inventoryInspection.findMany({
    where,
    include: includeInspection,
    orderBy: { createdAt: "desc" },
    take: query.take ? Number(query.take) : 200
  });

  return inspections;
}

export async function getInspection(id) {
  const inspection = await prisma.inventoryInspection.findUnique({
    where: { id: Number(id) },
    include: includeInspection
  });
  if (!inspection) throw notFound("Producto retenido no encontrado.");
  return mapInspection(inspection, await controlledPhysicalStock(prisma, inspection.productId));
}

export async function retainForReview(data, userId) {
  const productId = Number(data.productId);
  const inventoryLotId = Number(data.inventoryLotId);
  const quantity = roundQty(data.quantity);
  const reason = String(data.reason || "").trim();
  const notes = hasValue(data.notes) ? String(data.notes).trim() : null;
  const storageLocation = hasValue(data.storageLocation) ? String(data.storageLocation).trim() : null;

  if (!productId) throw new HttpError(422, "Selecciona un producto.");
  if (!inventoryLotId) throw new HttpError(422, "Selecciona el lote a retener.");
  if (quantity.lte(0)) throw new HttpError(422, "La cantidad debe ser mayor a cero.");
  if (!reason) throw new HttpError(422, "Ingresa un motivo para retener el producto.");

  return withInspectionTransaction(async (tx) => {
    await ensureUser(tx, userId);
    const [product, lot] = await Promise.all([
      tx.product.findUnique({ where: { id: productId }, include: { category: true } }),
      tx.inventoryLot.findUnique({ where: { id: inventoryLotId } })
    ]);

    if (!product) throw notFound("Producto no encontrado.");
    if (!lot) throw notFound("Lote no encontrado.");
    if (lot.productId !== product.id) throw new HttpError(422, "El lote no pertenece al producto indicado.");
    if (!lot.active) throw new HttpError(422, "El lote seleccionado esta inactivo.");

    const area = data.area || product.area;
    if (!allowedAreas.has(area)) throw new HttpError(422, "Area invalida para productos retenidos.");

    const lotUpdate = await tx.$executeRaw`
      UPDATE "InventoryLot"
      SET "currentQty" = "currentQty" - ${quantity}
      WHERE id = ${lot.id}
      AND active = true
      AND "currentQty" >= ${quantity}
    `;
    assertUpdatedRows(lotUpdate, "Stock insuficiente en el lote seleccionado.");

    const beforeQty = new Prisma.Decimal(product.stock);
    const productUpdate = await tx.$executeRaw`
      UPDATE "Product"
      SET stock = stock - ${quantity}
      WHERE id = ${product.id}
      AND stock >= ${quantity}
    `;
    assertUpdatedRows(productUpdate, `El producto ${product.name} no tiene stock suficiente.`);

    const inspection = await tx.inventoryInspection.create({
      data: {
        productId: product.id,
        inventoryLotId: lot.id,
        quantity,
        area,
        status: "PENDIENTE",
        reason,
        notes,
        storageLocation,
        createdById: userId || null
      },
      include: includeInspection
    });
    const reference = `INSPECCION:${inspection.id}:RETENCION`;
    const updatedInspection = await tx.inventoryInspection.update({
      where: { id: inspection.id },
      data: { reference },
      include: includeInspection
    });

    const updatedProduct = await tx.product.findUnique({ where: { id: product.id }, include: { category: true } });
    const afterQty = new Prisma.Decimal(updatedProduct.stock);
    const movement = await tx.inventoryMovement.create({
      data: {
        productId: product.id,
        inventoryLotId: lot.id,
        type: "SALIDA",
        origin: "OTRO",
        quantity,
        beforeQty,
        afterQty,
        unitCost: lot.unitCost,
        reason,
        reference,
        createdById: userId || null
      },
      include: includeMovement
    });

    await assertProductStockMatchesLots(tx, product.id);

    return {
      inspection: mapInspection(updatedInspection, await controlledPhysicalStock(tx, product.id)),
      product: { ...updatedProduct, stockStatus: statusFor(updatedProduct) },
      movement
    };
  });
}

export async function resolveInspection(id, data, userId) {
  const nextStatus = String(data.status || "").trim();
  const resolutionNotes = hasValue(data.resolutionNotes) ? String(data.resolutionNotes).trim() : null;

  if (!allowedResolutionStatuses.has(nextStatus)) {
    throw new HttpError(422, "La resolucion debe ser APTO o NO_APTO.");
  }

  return withInspectionTransaction(async (tx) => {
    await ensureUser(tx, userId);
    const inspection = await tx.inventoryInspection.findUnique({
      where: { id: Number(id) },
      include: includeInspection
    });
    if (!inspection) throw notFound("Producto retenido no encontrado.");
    if (inspection.status !== "PENDIENTE") throw new HttpError(422, "El producto retenido ya fue resuelto.");

    const quantity = roundQty(inspection.quantity);
    const [product, lot] = await Promise.all([
      tx.product.findUnique({ where: { id: inspection.productId }, include: { category: true } }),
      tx.inventoryLot.findUnique({ where: { id: inspection.inventoryLotId } })
    ]);
    if (!product) throw notFound("Producto no encontrado.");
    if (!lot) throw notFound("Lote no encontrado.");

    const statusUpdate = await tx.inventoryInspection.updateMany({
      where: { id: inspection.id, status: "PENDIENTE" },
      data: {
        status: nextStatus,
        resolvedById: userId || null,
        resolvedAt: new Date(),
        resolutionNotes,
        reference: `INSPECCION:${inspection.id}:${nextStatus}`
      }
    });
    assertUpdatedRows(statusUpdate.count, "El producto retenido ya fue resuelto.");

    let movement = null;
    let updatedProduct = product;

    if (nextStatus === "APTO") {
      const beforeQty = new Prisma.Decimal(product.stock);
      const lotUpdate = await tx.$executeRaw`
        UPDATE "InventoryLot"
        SET "currentQty" = "currentQty" + ${quantity}
        WHERE id = ${lot.id}
        AND active = true
      `;
      assertUpdatedRows(lotUpdate, "No se pudo devolver la cantidad al lote.");

      const productUpdate = await tx.$executeRaw`
        UPDATE "Product"
        SET stock = stock + ${quantity}
        WHERE id = ${product.id}
      `;
      assertUpdatedRows(productUpdate, "No se pudo devolver la cantidad al stock.");

      updatedProduct = await tx.product.findUnique({ where: { id: product.id }, include: { category: true } });
      const afterQty = new Prisma.Decimal(updatedProduct.stock);

      movement = await tx.inventoryMovement.create({
        data: {
          productId: product.id,
          inventoryLotId: lot.id,
          type: "ENTRADA",
          origin: "OTRO",
          quantity,
          beforeQty,
          afterQty,
          unitCost: lot.unitCost,
          reason: resolutionNotes || "Producto retenido declarado apto",
          reference: `INSPECCION:${inspection.id}:APTO`,
          createdById: userId || null
        },
        include: includeMovement
      });
    }

    await assertProductStockMatchesLots(tx, product.id);

    const resolved = await tx.inventoryInspection.findUnique({
      where: { id: inspection.id },
      include: includeInspection
    });

    return {
      inspection: mapInspection(resolved, await controlledPhysicalStock(tx, product.id)),
      product: { ...updatedProduct, stockStatus: statusFor(updatedProduct) },
      movement
    };
  });
}
