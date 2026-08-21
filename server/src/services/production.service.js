import { prisma } from "../config/prisma.js";
import { HttpError, notFound } from "../utils/httpError.js";
import { registerMovement } from "./inventory.service.js";

const includeProduction = {
  inputProduct: { include: { category: true } },
  outputProduct: { include: { category: true } }
};

function roundQty(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function sameUnit(inputProduct, outputProduct) {
  return String(inputProduct.unit).trim().toLowerCase() === String(outputProduct.unit).trim().toLowerCase();
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
  const totalInput = productions.reduce((sum, item) => sum + Number(item.inputQty), 0);
  const totalOutput = productions.reduce((sum, item) => sum + Number(item.outputQty), 0);
  const totalWaste = productions.reduce((sum, item) => sum + Number(item.wasteQty), 0);
  const yieldPercent = totalInput > 0 ? roundQty((totalOutput / totalInput) * 100) : 0;
  return { total: productions.length, totalInput, totalOutput, totalWaste, yieldPercent };
}

export async function createProduction(data, userId) {
  const inputProductId = Number(data.inputProductId);
  const outputProductId = Number(data.outputProductId);
  const inputQty = roundQty(data.inputQty);
  const outputQty = roundQty(data.outputQty);
  if (!inputProductId || !outputProductId) throw new HttpError(422, "Selecciona materia prima y producto obtenido.");
  if (inputProductId === outputProductId) throw new HttpError(422, "El producto origen y el obtenido deben ser distintos.");
  if (inputQty <= 0 || outputQty <= 0) throw new HttpError(422, "Las cantidades deben ser mayores a cero.");
  if (outputQty > inputQty) throw new HttpError(422, "El producto obtenido no puede superar la materia prima usada.");

  return prisma.$transaction(async (tx) => {
    const [inputProduct, outputProduct] = await Promise.all([
      tx.product.findUnique({ where: { id: inputProductId }, include: { category: true } }),
      tx.product.findUnique({ where: { id: outputProductId }, include: { category: true } })
    ]);
    if (!inputProduct || !outputProduct) throw notFound("Producto no encontrado.");
    if (inputProduct.area !== outputProduct.area) throw new HttpError(422, "La materia prima y el producto obtenido deben pertenecer a la misma area.");
    if (!sameUnit(inputProduct, outputProduct)) throw new HttpError(422, "Para esta etapa controlada ambos productos deben usar la misma unidad.");

    const beforeInput = Number(inputProduct.stock);
    if (beforeInput < inputQty) {
      throw new HttpError(422, "Stock insuficiente para iniciar produccion.", {
        productId: inputProduct.id,
        productName: inputProduct.name,
        required: inputQty,
        available: beforeInput
      });
    }

    const beforeOutput = Number(outputProduct.stock);
    const afterInput = roundQty(beforeInput - inputQty);
    const afterOutput = roundQty(beforeOutput + outputQty);
    const wasteQty = roundQty(inputQty - outputQty);
    const yieldPercent = roundQty((outputQty / inputQty) * 100);
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

    const productionUsedQty = roundQty(inputQty - wasteQty);

    if (productionUsedQty > 0) {
      await registerMovement("SALIDA", {
        productId: inputProductId,
        quantity: productionUsedQty,
        origin: "PRODUCCION",
        reason: `Materia prima usada en produccion ${code}`,
        reference: `PRODUCCION:${production.id}:INSUMO`
      }, userId, tx);
    }

    if (wasteQty > 0) {
      await registerMovement("SALIDA", {
        productId: inputProductId,
        quantity: wasteQty,
        origin: "MERMA",
        reason: `Merma de produccion ${code}`,
        reference: `MERMA:PROD_${production.id}`
      }, userId, tx);
    }

    await registerMovement("ENTRADA", {
      productId: outputProductId,
      quantity: outputQty,
      origin: "PRODUCCION",
      reason: `Producto obtenido en produccion ${code}. Merma ${wasteQty} ${inputProduct.unit}`,
      reference: `PRODUCCION:${production.id}:OBTENIDO`
    }, userId, tx);

    return production;
  });
}
