import { prisma } from "../config/prisma.js";
import { Prisma } from "@prisma/client";
import { HttpError, notFound } from "../utils/httpError.js";
import { getAvailableLotsForProduct } from "./inventory-lot.service.js";

const recipeAreas = new Set(["RESTAURANTE", "BARTENDER"]);

function normalizeUnit(unit = "") {
  const value = String(unit).trim().toLowerCase();
  if (["l", "lt", "lts", "litro", "litros"].includes(value)) return "l";
  if (["ml", "mililitro", "mililitros"].includes(value)) return "ml";
  if (["kg", "kilo", "kilos", "kilogramo", "kilogramos"].includes(value)) return "kg";
  if (["g", "gr", "gramo", "gramos"].includes(value)) return "g";
  if (["und", "unidad", "unidades"].includes(value)) return "unidad";
  return value;
}

// Retorna Prisma.Decimal o null
function convertQuantity(quantity, fromUnit, toUnit) {
  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);
  const value = new Prisma.Decimal(quantity || 0);
  
  if (from === to) return value;
  if (from === "g" && to === "kg") return value.dividedBy(1000);
  if (from === "kg" && to === "g") return value.times(1000);
  if (from === "ml" && to === "l") return value.dividedBy(1000);
  if (from === "l" && to === "ml") return value.times(1000);
  return null;
}

// Redondeo final a Decimal(14, 4)
export function roundQty(value) {
  return new Prisma.Decimal(value || 0).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
}

function isInventoryArea(area) {
  return recipeAreas.has(area);
}

// Calcula suma de allocations activas por producto
async function activeReservedByProduct(db, productIds, orderId) {
  if (!productIds.length) return new Map();

  const items = await db.orderStockReservationItem.findMany({
    where: {
      productId: { in: productIds },
      reservation: { status: "ACTIVA", orderId: { not: orderId } }
    },
    select: { productId: true, quantity: true }
  });

  return items.reduce((map, item) => {
    const qty = new Prisma.Decimal(item.quantity);
    const current = map.get(item.productId) || new Prisma.Decimal(0);
    map.set(item.productId, current.plus(qty));
    return map;
  }, new Map());
}

export async function buildOrderRecipePlan(orderOrId, db = prisma) {
  const order = typeof orderOrId === "number"
    ? await db.order.findUnique({
        where: { id: orderOrId },
        include: { items: { include: { product: true } } }
      })
    : orderOrId;
  if (!order) throw notFound("Pedido no encontrado.");

  if (!isInventoryArea(order.area)) {
    return { orderId: order.id, area: order.area, requirements: [], missingRecipes: [], issues: [] };
  }

  const requirements = new Map();
  const missingRecipes = [];
  const issues = [];

  for (const orderItem of order.items || []) {
    const orderedQty = new Prisma.Decimal(orderItem.quantity || 1);

    const recipe = await db.recipe.findFirst({
      where: {
        area: order.area,
        active: true,
        name: { equals: orderItem.name, mode: "insensitive" }
      },
      include: { items: { include: { product: { include: { category: true } } } } }
    });

    if (recipe?.items?.length) {
      for (const ingredient of recipe.items) {
        const converted = convertQuantity(ingredient.quantity, ingredient.unit, ingredient.product.unit);
        if (converted === null) {
          issues.push({
            type: "UNIDAD_INCOMPATIBLE",
            productId: ingredient.productId,
            productName: ingredient.product.name,
            recipeUnit: ingredient.unit,
            inventoryUnit: ingredient.product.unit,
            source: recipe.name
          });
          continue;
        }

        const requiredTotal = converted.times(orderedQty);
        
        const sourceJson = {
          orderItemId: orderItem.id,
          recipeId: recipe.id,
          recipeName: recipe.name,
          orderedQuantity: orderedQty.toNumber(),
          ingredientProductId: ingredient.productId,
          ingredientName: ingredient.product.name,
          quantityPerUnit: new Prisma.Decimal(ingredient.quantity).toNumber(),
          recipeUnit: ingredient.unit,
          requiredQty: requiredTotal.toNumber(),
          requiredUnit: ingredient.product.unit
        };

        const current = requirements.get(ingredient.product.id);
        if (current) {
          current.required = current.required.plus(requiredTotal);
          current.sourcesJson.push(sourceJson);
        } else {
          requirements.set(ingredient.product.id, {
            productId: ingredient.product.id,
            product: ingredient.product,
            required: requiredTotal,
            unit: ingredient.product.unit,
            sourcesJson: [sourceJson]
          });
        }
      }
      continue;
    }

    if (orderItem.product) {
      const sourceJson = {
        orderItemId: orderItem.id,
        recipeId: null,
        recipeName: null,
        orderedQuantity: orderedQty.toNumber(),
        ingredientProductId: orderItem.product.id,
        ingredientName: orderItem.product.name,
        quantityPerUnit: 1,
        recipeUnit: orderItem.product.unit,
        requiredQty: orderedQty.toNumber(),
        requiredUnit: orderItem.product.unit
      };

      const current = requirements.get(orderItem.product.id);
      if (current) {
        current.required = current.required.plus(orderedQty);
        current.sourcesJson.push(sourceJson);
      } else {
        requirements.set(orderItem.product.id, {
          productId: orderItem.product.id,
          product: orderItem.product,
          required: orderedQty,
          unit: orderItem.product.unit,
          sourcesJson: [sourceJson]
        });
      }
    } else {
      missingRecipes.push({
        itemId: orderItem.id,
        name: orderItem.name,
        quantity: orderItem.quantity
      });
    }
  }

  const productIds = [...requirements.keys()];
  const reservedMap = await activeReservedByProduct(db, productIds, order.id);
  
  const lines = [...requirements.values()].map((line) => {
    const requiredStr = roundQty(line.required);
    
    // Convert to Prisma.Decimal
    const stock = new Prisma.Decimal(line.product.stock || 0);
    const reserved = reservedMap.get(line.productId) || new Prisma.Decimal(0);
    const available = roundQty(stock.minus(reserved));
    const enough = available.gte(requiredStr);
    
    return {
      productId: line.productId,
      productName: line.product.name,
      category: line.product.category?.name || null,
      required: requiredStr.toNumber(),
      available: available.toNumber(),
      reserved: roundQty(reserved).toNumber(),
      stock: stock.toNumber(),
      unit: line.unit,
      cost: Number(line.product.cost || 0),
      stockStatus: stock.lte(0) ? "SIN_STOCK" : stock.lte(line.product.minStock || 0) ? "STOCK_BAJO" : "OK",
      enough,
      sourcesJson: line.sourcesJson
    };
  });

  const insufficient = lines.filter((line) => !line.enough);
  return {
    orderId: order.id,
    area: order.area,
    requirements: lines,
    missingRecipes,
    issues,
    insufficient,
    canPrepare: !missingRecipes.length && !issues.length && !insufficient.length
  };
}

export async function reserveOrderStock(orderId, userId, db = prisma) {
  let attempts = 0;
  const maxAttempts = 10;
  while (attempts < maxAttempts) {
    try {
      return await db.$transaction(async (tx) => {
        const order = await tx.order.findUnique({
          where: { id: orderId },
          include: { stockReservation: true, items: true }
        });
        if (!order) throw notFound("Pedido no encontrado.");
        
        if (order.stockReservation?.status === "ACTIVA") {
          return tx.orderStockReservation.findUnique({
            where: { orderId },
            include: { items: { include: { product: true, allocations: true } } }
          });
        }
        if (order.stockReservation?.status === "CONSUMIDA") {
          throw new HttpError(422, "Este pedido ya consumio inventario.");
        }

        if (order.stockReservation?.status === "LIBERADA") {
          throw new HttpError(422, "Este pedido fue liberado/cancelado y no puede volver a reservar inventario.");
        }

        const plan = await buildOrderRecipePlan(order, tx);
        if (!plan.canPrepare) {
          throw new HttpError(422, "No hay stock suficiente o falta configurar receta.", {
            insufficient: plan.insufficient,
            missingRecipes: plan.missingRecipes,
            issues: plan.issues
          });
        }

        const reservation = await tx.orderStockReservation.create({
          data: {
            orderId,
            status: "ACTIVA",
            createdById: userId || null,
          }
        });

        for (const line of plan.requirements) {
          const reqQty = new Prisma.Decimal(line.required); // Ya viene de roundQty en .toNumber()
          
          const resItem = await tx.orderStockReservationItem.create({
            data: {
              reservationId: reservation.id,
              productId: line.productId,
              quantity: reqQty,
              unit: line.unit,
              source: JSON.stringify(line.sourcesJson),
              sourcesJson: line.sourcesJson
            }
          });

          const lots = await getAvailableLotsForProduct(line.productId, tx);
          let pending = reqQty;
          
          for (const lot of lots) {
            if (pending.lte(0)) break;
            
            const allocs = await tx.orderStockLotAllocation.aggregate({
              where: { 
                inventoryLotId: lot.id, 
                reservationItem: { reservation: { status: "ACTIVA" } } 
              },
              _sum: { quantity: true }
            });
            
            const usedInLot = new Prisma.Decimal(allocs._sum.quantity || 0);
            const lotAvail = new Prisma.Decimal(lot.currentQty).minus(usedInLot);
            
            if (lotAvail.lte(0)) continue;
            
            const toTake = Prisma.Decimal.min(pending, lotAvail);
            
            await tx.orderStockLotAllocation.create({
              data: {
                reservationItemId: resItem.id,
                inventoryLotId: lot.id,
                quantity: toTake
              }
            });
            
            pending = pending.minus(toTake);
          }
          
          if (pending.gt(0)) {
            throw new HttpError(409, `Concurrencia: No hay suficientes lotes disponibles para el producto ${line.productName}`);
          }
        }

        return tx.orderStockReservation.findUnique({
          where: { orderId },
          include: { items: { include: { allocations: true, product: true } } }
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); 
    } catch (error) {
      if (error.code === 'P2034' && attempts < maxAttempts - 1) {
        attempts++;
        const jitter = Math.floor(Math.random() * 300);
        await new Promise(res => setTimeout(res, 100 * attempts + jitter)); 
        continue;
      }
      throw error;
    }
  }
}

export async function consumeOrderReservation(orderId, orderCode, userId, db = prisma) {
  return await db.$transaction(async (tx) => {
    // 1. Update atómico
    const updateResult = await tx.$executeRaw`
      UPDATE "OrderStockReservation"
      SET status = 'CONSUMIDA', "consumedAt" = NOW()
      WHERE "orderId" = ${orderId} AND status = 'ACTIVA'
    `;

    if (updateResult === 0) {
      const checkRes = await tx.orderStockReservation.findUnique({ where: { orderId } });
      if (!checkRes || checkRes.status === "LIBERADA") {
        throw new HttpError(422, "No se puede consumir un pedido sin reservar o que ha sido liberado.");
      }
      if (checkRes.status === "CONSUMIDA") {
        return checkRes;
      }
    }

    const reservation = await tx.orderStockReservation.findUnique({
      where: { orderId },
      include: { 
        items: { 
          include: { 
            allocations: true, 
            product: true 
          } 
        } 
      }
    });

    for (const item of reservation.items) {
      for (const allocation of item.allocations) {
        const qty = new Prisma.Decimal(allocation.quantity);

        // Descuento atómico del Lote
        const updateLot = await tx.$executeRaw`
          UPDATE "InventoryLot"
          SET "currentQty" = "currentQty" - ${qty}
          WHERE id = ${allocation.inventoryLotId}
          AND "currentQty" >= ${qty}
        `;

        if (updateLot === 0) {
          throw new HttpError(500, `Inconsistencia critica: El lote ID ${allocation.inventoryLotId} no existe o se sobregiraria negativamente al consumir ${qty}`);
        }

        // Descuento atómico del Producto Global
        const updateProd = await tx.$executeRaw`
          UPDATE "Product"
          SET stock = stock - ${qty}
          WHERE id = ${item.productId}
          AND stock >= ${qty}
        `;

        if (updateProd === 0) {
          throw new HttpError(500, `Inconsistencia critica: El producto ID ${item.productId} no existe o se sobregiraria negativamente al consumir ${qty}`);
        }

        // Leer datos actuales para guardar historial
        const lot = await tx.inventoryLot.findUnique({ where: { id: allocation.inventoryLotId }});
        const prod = await tx.product.findUnique({ where: { id: item.productId }});

        const afterProdStock = new Prisma.Decimal(prod.stock);
        const currentProdStock = afterProdStock.plus(qty);

        await tx.inventoryMovement.create({
          data: {
            productId: item.productId,
            inventoryLotId: lot.id,
            allocationId: allocation.id,
            type: "SALIDA",
            origin: "PEDIDO",
            quantity: qty,
            beforeQty: currentProdStock,
            afterQty: afterProdStock,
            unitCost: lot.unitCost,
            reason: `Consumo receta pedido ${orderCode} (Lote ${lot.code})`,
            reference: `PEDIDO:${orderId}`,
            createdById: userId || null
          }
        });
      }
    }

    return reservation;
  });
}

export async function releaseOrderReservation(orderId, db = prisma) {
  return await db.$transaction(async (tx) => {
    const updateResult = await tx.$executeRaw`
      UPDATE "OrderStockReservation"
      SET status = 'LIBERADA', "releasedAt" = NOW()
      WHERE "orderId" = ${orderId} AND status = 'ACTIVA'
    `;

    if (updateResult === 0) {
      const checkRes = await tx.orderStockReservation.findUnique({ where: { orderId } });
      if (!checkRes) return checkRes;
      if (checkRes.status === "CONSUMIDA") {
        throw new HttpError(422, "No se puede liberar un pedido que ya ha sido consumido.");
      }
      return checkRes; 
    }

    return tx.orderStockReservation.findUnique({ where: { orderId } });
  });
}
