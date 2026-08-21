import { prisma } from "../config/prisma.js";
import { Prisma } from "@prisma/client";
import { HttpError, notFound } from "../utils/httpError.js";
import { getAvailableLotsForProduct } from "./inventory-lot.service.js";

const includeProduction = {
  inputProduct: { include: { category: true } },
  outputProduct: { include: { category: true } }
};

// Redondeo final a Decimal(14, 4)
export function roundQty(value) {
  return new Prisma.Decimal(value || 0).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
}

function sameUnit(inputProduct, outputProduct) {
  return String(inputProduct.unit).trim().toLowerCase() === String(outputProduct.unit).trim().toLowerCase();
}

function isSerializableConflict(error) {
  return error?.code === "P2034" || error?.meta?.code === "40001";
}

async function withProductionTransaction(operation) {
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
  throw new HttpError(500, "No se pudo completar la produccion.");
}

function assertUpdatedRows(result, message) {
  if (Number(result) === 0) throw new HttpError(500, message);
}

function makePhysicalSegments(quantity, state) {
  const segments = [];
  let remaining = roundQty(quantity);

  if (state.productiveRemaining.gt(0) && remaining.gt(0)) {
    const productiveQty = Prisma.Decimal.min(remaining, state.productiveRemaining);
    if (productiveQty.gt(0)) {
      segments.push({ quantity: productiveQty, origin: "PRODUCCION" });
      state.productiveRemaining = roundQty(state.productiveRemaining.minus(productiveQty));
      remaining = roundQty(remaining.minus(productiveQty));
    }
  }

  if (state.wasteRemaining.gt(0) && remaining.gt(0)) {
    const wasteQty = Prisma.Decimal.min(remaining, state.wasteRemaining);
    if (wasteQty.gt(0)) {
      segments.push({ quantity: wasteQty, origin: "MERMA" });
      state.wasteRemaining = roundQty(state.wasteRemaining.minus(wasteQty));
      remaining = roundQty(remaining.minus(wasteQty));
    }
  }

  if (remaining.gt(0)) {
    segments.push({ quantity: remaining, origin: "PRODUCCION" });
  }

  return segments;
}

async function consumeInputLots(tx, { inputProduct, inputQty, outputQty, wasteQty, production, code, userId }) {
  const availableLots = await getAvailableLotsForProduct(inputProduct.id, tx);
  const availableQty = availableLots.reduce((sum, lot) => sum.plus(lot.currentQty), new Prisma.Decimal(0));

  if (availableQty.lt(inputQty)) {
    throw new HttpError(422, "Stock insuficiente por lotes para iniciar produccion.", {
      productId: inputProduct.id,
      productName: inputProduct.name,
      required: inputQty.toNumber(),
      available: availableQty.toNumber()
    });
  }

  let remaining = inputQty;
  const splitState = {
    productiveRemaining: roundQty(outputQty),
    wasteRemaining: roundQty(wasteQty)
  };

  for (const lot of availableLots) {
    if (remaining.lte(0)) break;

    const lotAvailable = new Prisma.Decimal(lot.currentQty);
    const physicalQty = Prisma.Decimal.min(remaining, lotAvailable);
    remaining = roundQty(remaining.minus(physicalQty));

    const segments = makePhysicalSegments(physicalQty, splitState);

    for (const segment of segments) {
      const qty = roundQty(segment.quantity);
      const lotUpdate = await tx.$executeRaw`
        UPDATE "InventoryLot"
        SET "currentQty" = "currentQty" - ${qty}
        WHERE id = ${lot.id}
        AND "currentQty" >= ${qty}
      `;
      assertUpdatedRows(lotUpdate, `Inconsistencia critica: el lote ${lot.code} no existe o se sobregiraria.`);

      const productUpdate = await tx.$executeRaw`
        UPDATE "Product"
        SET stock = stock - ${qty}
        WHERE id = ${inputProduct.id}
        AND stock >= ${qty}
      `;
      assertUpdatedRows(productUpdate, `Inconsistencia critica: el producto ${inputProduct.name} no existe o se sobregiraria.`);

      const updatedProduct = await tx.product.findUnique({ where: { id: inputProduct.id } });
      const afterQty = new Prisma.Decimal(updatedProduct.stock);
      const beforeQty = afterQty.plus(qty);
      const reason = segment.origin === "MERMA"
        ? `Merma de produccion ${code} (Lote ${lot.code})`
        : `Materia prima usada en produccion ${code} (Lote ${lot.code})`;
      const reference = segment.origin === "MERMA"
        ? `PRODUCCION:${production.id}:MERMA`
        : `PRODUCCION:${production.id}:INSUMO`;

      await tx.inventoryMovement.create({
        data: {
          productId: inputProduct.id,
          inventoryLotId: lot.id,
          type: "SALIDA",
          origin: segment.origin,
          quantity: qty,
          beforeQty,
          afterQty,
          unitCost: lot.unitCost,
          reason,
          reference,
          createdById: userId || null
        }
      });
    }
  }

  if (remaining.gt(0)) {
    throw new HttpError(422, "Stock insuficiente por lotes para completar la produccion.");
  }
}

async function createOutputLot(tx, { outputProduct, outputQty, inputProduct, production, code, wasteQty, userId }) {
  const lotCode = `PROD-${production.id}`;
  const beforeQty = new Prisma.Decimal(outputProduct.stock);

  const outputLot = await tx.inventoryLot.create({
    data: {
      productId: outputProduct.id,
      code: lotCode,
      initialQty: outputQty,
      currentQty: outputQty,
      unitCost: inputProduct.cost
    }
  });

  await tx.product.update({
    where: { id: outputProduct.id },
    data: { stock: { increment: outputQty } }
  });

  const afterQty = beforeQty.plus(outputQty);

  await tx.inventoryMovement.create({
    data: {
      productId: outputProduct.id,
      inventoryLotId: outputLot.id,
      type: "ENTRADA",
      origin: "PRODUCCION",
      quantity: outputQty,
      beforeQty,
      afterQty,
      unitCost: inputProduct.cost,
      reason: `Producto obtenido en produccion ${code}. Merma ${wasteQty.toFixed(4)} ${inputProduct.unit}`,
      reference: `PRODUCCION:${production.id}:OBTENIDO`,
      createdById: userId || null
    }
  });
}

export function listProductions(query = {}) {
  return prisma.productionBatch.findMany({
    where: {
      area: query.area || undefined,
      inputProductId: query.productId ? Number(query.productId) : undefined,
      createdAt: query.from || query.to ? {
        gte: query.from ? new Date(query.from) : undefined,
        lte: query.to ? new Date(query.to) : undefined
      } : undefined
    },
    include: includeProduction,
    orderBy: { createdAt: "desc" },
    take: 200
  });
}

export async function productionSummary(query = {}) {
  const productions = await listProductions(query);
  
  const totalInput = productions.reduce((sum, item) => sum.plus(item.inputQty || 0), new Prisma.Decimal(0));
  const totalOutput = productions.reduce((sum, item) => sum.plus(item.outputQty || 0), new Prisma.Decimal(0));
  const totalWaste = productions.reduce((sum, item) => sum.plus(item.wasteQty || 0), new Prisma.Decimal(0));
  
  let yieldPercent = new Prisma.Decimal(0);
  if (totalInput.gt(0)) {
    yieldPercent = roundQty(totalOutput.dividedBy(totalInput).times(100));
  }
  
  return { 
    total: productions.length, 
    totalInput: totalInput.toNumber(), 
    totalOutput: totalOutput.toNumber(), 
    totalWaste: totalWaste.toNumber(), 
    yieldPercent: yieldPercent.toNumber() 
  };
}

export async function createProduction(data, userId) {
  const inputProductId = Number(data.inputProductId);
  const outputProductId = Number(data.outputProductId);
  const inputQty = roundQty(data.inputQty);
  const outputQty = roundQty(data.outputQty);
  
  if (!inputProductId || !outputProductId) throw new HttpError(422, "Selecciona materia prima y producto obtenido.");
  if (inputProductId === outputProductId) throw new HttpError(422, "El producto origen y el obtenido deben ser distintos.");
  if (inputQty.lte(0) || outputQty.lte(0)) throw new HttpError(422, "Las cantidades deben ser mayores a cero.");
  if (outputQty.gt(inputQty)) throw new HttpError(422, "El producto obtenido no puede superar la materia prima usada.");

  return withProductionTransaction(async (tx) => {
    const [inputProduct, outputProduct] = await Promise.all([
      tx.product.findUnique({ where: { id: inputProductId }, include: { category: true } }),
      tx.product.findUnique({ where: { id: outputProductId }, include: { category: true } })
    ]);
    
    if (!inputProduct || !outputProduct) throw notFound("Producto no encontrado.");
    if (inputProduct.area !== outputProduct.area) throw new HttpError(422, "La materia prima y el producto obtenido deben pertenecer a la misma area.");
    if (!sameUnit(inputProduct, outputProduct)) throw new HttpError(422, "Para esta etapa controlada ambos productos deben usar la misma unidad.");

    const beforeInput = new Prisma.Decimal(inputProduct.stock);
    const availableLots = await getAvailableLotsForProduct(inputProduct.id, tx);
    const availableLotQty = availableLots.reduce((sum, lot) => sum.plus(lot.currentQty), new Prisma.Decimal(0));

    if (beforeInput.lt(inputQty) || availableLotQty.lt(inputQty)) {
      throw new HttpError(422, "Stock insuficiente para iniciar produccion.", {
        productId: inputProduct.id,
        productName: inputProduct.name,
        required: inputQty.toNumber(),
        available: Prisma.Decimal.min(beforeInput, availableLotQty).toNumber()
      });
    }

    const wasteQty = roundQty(inputQty.minus(outputQty));
    const yieldPercent = roundQty(outputQty.dividedBy(inputQty).times(100));
    
    const count = await tx.productionBatch.count();
    const code = `PROD-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;

    const production = await tx.productionBatch.create({
      data: {
        code,
        area: inputProduct.area,
        inputProductId,
        outputProductId,
        inputQty,
        outputQty,
        wasteQty,
        yieldPercent,
        notes: data.notes || null,
        createdById: userId || null
      },
      include: includeProduction
    });

    await consumeInputLots(tx, { inputProduct, inputQty, outputQty, wasteQty, production, code, userId });
    await createOutputLot(tx, { outputProduct, outputQty, inputProduct, production, code, wasteQty, userId });

    return production;
  });
}
