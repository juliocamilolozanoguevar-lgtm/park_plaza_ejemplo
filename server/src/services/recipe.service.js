import { prisma } from "../config/prisma.js";
import { HttpError, notFound } from "../utils/httpError.js";
import { registerMovement } from "./inventory.service.js";

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

function convertQuantity(quantity, fromUnit, toUnit) {
  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);
  const value = Number(quantity || 0);
  if (from === to) return value;
  if (from === "g" && to === "kg") return value / 1000;
  if (from === "kg" && to === "g") return value * 1000;
  if (from === "ml" && to === "l") return value / 1000;
  if (from === "l" && to === "ml") return value * 1000;
  return null;
}

function roundQty(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function isInventoryArea(area) {
  return recipeAreas.has(area);
}

async function activeReservedByProduct(db, productIds, orderId) {
  if (!productIds.length) return new Map();
  const rows = await db.orderStockReservationItem.findMany({
    where: {
      productId: { in: productIds },
      reservation: { status: "ACTIVA", orderId: { not: orderId } }
    },
    select: { productId: true, quantity: true }
  });
  return rows.reduce((map, item) => {
    map.set(item.productId, roundQty((map.get(item.productId) || 0) + Number(item.quantity)));
    return map;
  }, new Map());
}

function addRequirement(requirements, product, quantity, unit, source) {
  const current = requirements.get(product.id);
  const required = roundQty(quantity);
  if (current) {
    current.required = roundQty(current.required + required);
    current.sources.push(source);
    return;
  }
  requirements.set(product.id, {
    productId: product.id,
    product,
    required,
    unit,
    sources: [source]
  });
}

export async function buildOrderRecipePlan(orderOrId, db = prisma) {
  const order = typeof orderOrId === "number"
    ? await db.order.findUnique({
        where: { id: orderOrId },
        include: { items: { include: { product: true } }, stay: { include: { client: true, room: true } } }
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
        addRequirement(
          requirements,
          ingredient.product,
          converted * Number(orderItem.quantity || 1),
          ingredient.product.unit,
          `${Number(orderItem.quantity || 1)} x ${recipe.name}`
        );
      }
      continue;
    }

    if (orderItem.product) {
      addRequirement(
        requirements,
        orderItem.product,
        Number(orderItem.quantity || 1),
        orderItem.product.unit,
        `${Number(orderItem.quantity || 1)} x ${orderItem.name}`
      );
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
    const stock = Number(line.product.stock || 0);
    const reserved = Number(reservedMap.get(line.productId) || 0);
    const available = roundQty(stock - reserved);
    const enough = available >= line.required;
    return {
      productId: line.productId,
      productName: line.product.name,
      category: line.product.category?.name || null,
      required: line.required,
      available,
      reserved,
      stock,
      unit: line.unit,
      cost: Number(line.product.cost || 0),
      stockStatus: stock <= 0 ? "SIN_STOCK" : stock <= Number(line.product.minStock || 0) ? "STOCK_BAJO" : "OK",
      enough,
      sources: line.sources
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
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      items: { include: { product: { include: { category: true } } } },
      stockReservation: { include: { items: true } }
    }
  });
  if (!order) throw notFound("Pedido no encontrado.");
  if (order.stockReservation?.status === "ACTIVA") {
    return db.orderStockReservation.findUnique({
      where: { orderId },
      include: { items: { include: { product: true } } }
    });
  }
  if (order.stockReservation?.status === "CONSUMIDA") {
    throw new HttpError(422, "Este pedido ya consumio inventario.");
  }

  const plan = await buildOrderRecipePlan(order, db);
  if (!plan.canPrepare) {
    throw new HttpError(422, "No hay stock suficiente o falta configurar receta.", {
      insufficient: plan.insufficient,
      missingRecipes: plan.missingRecipes,
      issues: plan.issues
    });
  }

  return db.orderStockReservation.upsert({
    where: { orderId },
    update: {
      status: "ACTIVA",
      createdById: userId || null,
      consumedAt: null,
      releasedAt: null,
      items: {
        deleteMany: {},
        create: plan.requirements.map((line) => ({
          productId: line.productId,
          quantity: line.required,
          unit: line.unit,
          source: line.sources.join(", ")
        }))
      }
    },
    create: {
      orderId,
      status: "ACTIVA",
      createdById: userId || null,
      items: {
        create: plan.requirements.map((line) => ({
          productId: line.productId,
          quantity: line.required,
          unit: line.unit,
          source: line.sources.join(", ")
        }))
      }
    },
    include: { items: { include: { product: true } } }
  });
}

export async function consumeOrderReservation(orderId, orderCode, userId, db = prisma) {
  const existingMovement = await db.inventoryMovement.findFirst({
    where: { 
      OR: [
        { reference: `CONSUMO_RECETA:${orderId}` },
        { reference: `PEDIDO:${orderId}` }
      ]
    }
  });
  if (existingMovement) {
    return db.orderStockReservation.update({
      where: { orderId },
      data: { status: "CONSUMIDA", consumedAt: new Date() },
      include: { items: { include: { product: true } } }
    });
  }

  let reservation = await db.orderStockReservation.findUnique({
    where: { orderId },
    include: { items: { include: { product: true } } }
  });
  if (!reservation || reservation.status === "LIBERADA") {
    reservation = await reserveOrderStock(orderId, userId, db);
  }
  if (reservation.status === "CONSUMIDA") return reservation;

  for (const item of reservation.items) {
    await registerMovement("SALIDA", {
      productId: item.productId,
      quantity: item.quantity,
      origin: "PEDIDO",
      reason: `Consumo receta pedido ${orderCode}`,
      reference: `PEDIDO:${orderId}`
    }, userId, db);
  }

  return db.orderStockReservation.update({
    where: { orderId },
    data: { status: "CONSUMIDA", consumedAt: new Date() },
    include: { items: { include: { product: true } } }
  });
}

export async function releaseOrderReservation(orderId, db = prisma) {
  const reservation = await db.orderStockReservation.findUnique({ where: { orderId } });
  if (!reservation || reservation.status !== "ACTIVA") return reservation;
  return db.orderStockReservation.update({
    where: { orderId },
    data: { status: "LIBERADA", releasedAt: new Date() },
    include: { items: { include: { product: true } } }
  });
}
