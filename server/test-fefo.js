import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "./src/config/prisma.js";
import {
  buildOrderRecipePlan,
  consumeOrderReservation,
  releaseOrderReservation,
  reserveOrderStock
} from "./src/services/recipe.service.js";
import { getAvailableLotsForProduct, getLimaStartOfDayUTC } from "./src/services/inventory-lot.service.js";

const PREFIX = "ZZTEST_F3_";
const AREA = "RESTAURANTE";
const TEST_USER_ID = null;
const results = [];

const dec = (value) => new Prisma.Decimal(value || 0);
const qty = (value) => new Prisma.Decimal(value || 0).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
const eqDecimal = (actual, expected) => dec(actual).equals(dec(expected));

async function assert(condition, name, detail = "") {
  if (!condition) {
    results.push({ name, status: "FALLO", detail });
    throw new Error(`${name}${detail ? `: ${detail}` : ""}`);
  }
  results.push({ name, status: "PASO", detail });
  console.log(`OK - ${name}${detail ? `: ${detail}` : ""}`);
}

async function assertRejects(fn, name, expectedText = "") {
  try {
    await fn();
  } catch (error) {
    const message = error?.message || "";
    await assert(!expectedText || message.includes(expectedText), name, message);
    return error;
  }
  throw new Error(`${name}: se esperaba rechazo explicito`);
}

async function cleanup() {
  await prisma.inventoryMovement.deleteMany({
    where: {
      OR: [
        { reference: { startsWith: PREFIX } },
        { reason: { contains: PREFIX } },
        { inventoryLot: { code: { startsWith: PREFIX } } },
        { product: { name: { startsWith: PREFIX } } }
      ]
    }
  });
  await prisma.orderStockLotAllocation.deleteMany({
    where: {
      OR: [
        { inventoryLot: { code: { startsWith: PREFIX } } },
        { reservationItem: { reservation: { order: { code: { startsWith: PREFIX } } } } }
      ]
    }
  });
  await prisma.orderStockReservationItem.deleteMany({
    where: {
      OR: [
        { product: { name: { startsWith: PREFIX } } },
        { reservation: { order: { code: { startsWith: PREFIX } } } }
      ]
    }
  });
  await prisma.orderStockReservation.deleteMany({ where: { order: { code: { startsWith: PREFIX } } } });
  await prisma.recipeItem.deleteMany({
    where: {
      OR: [
        { product: { name: { startsWith: PREFIX } } },
        { recipe: { name: { startsWith: PREFIX } } }
      ]
    }
  });
  await prisma.recipe.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.inventoryLot.deleteMany({ where: { product: { name: { startsWith: PREFIX } } } });
  await prisma.orderItem.deleteMany({ where: { order: { code: { startsWith: PREFIX } } } });
  await prisma.order.deleteMany({ where: { code: { startsWith: PREFIX } } });
  await prisma.product.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.category.deleteMany({ where: { name: `${PREFIX}CATEGORY` } });
}

async function ensureCategory() {
  return prisma.category.upsert({
    where: { name: `${PREFIX}CATEGORY` },
    update: {},
    create: { name: `${PREFIX}CATEGORY`, description: "Categoria aislada para pruebas Fase 3" }
  });
}

async function createProduct(category, suffix, stock = "0", unit = "kg") {
  return prisma.product.create({
    data: {
      name: `${PREFIX}${suffix}`,
      categoryId: category.id,
      area: AREA,
      unit,
      stock: qty(stock),
      minStock: 0,
      cost: 10,
      price: 20
    }
  });
}

async function createRecipe(name, product, quantity, unit = product.unit) {
  return prisma.recipe.create({
    data: {
      name,
      area: AREA,
      items: { create: [{ productId: product.id, quantity: qty(quantity), unit }] }
    },
    include: { items: true }
  });
}

async function createOrder(codeSuffix, itemName, quantity = 1, productId = null) {
  return prisma.order.create({
    data: {
      code: `${PREFIX}${codeSuffix}`,
      area: AREA,
      total: 20,
      items: {
        create: [{
          productId,
          name: itemName,
          quantity,
          price: 20,
          category: "TEST"
        }]
      }
    },
    include: { items: true }
  });
}

async function createLot(product, suffix, lotQty, { expiresAt = null, receivedAt = new Date("2026-08-01T10:00:00.000Z") } = {}) {
  return prisma.inventoryLot.create({
    data: {
      productId: product.id,
      code: `${PREFIX}${suffix}`,
      initialQty: qty(lotQty),
      currentQty: qty(lotQty),
      unitCost: 10,
      receivedAt,
      expiresAt
    }
  });
}

async function getReservation(orderId) {
  return prisma.orderStockReservation.findUnique({
    where: { orderId },
    include: { items: { include: { allocations: { orderBy: { id: "asc" }, include: { inventoryLot: true } }, product: true } } }
  });
}

async function countOrderAllocations(orderId) {
  return prisma.orderStockLotAllocation.count({ where: { reservationItem: { reservation: { orderId } } } });
}

async function productStock(productId) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  return dec(product.stock);
}

async function lotQty(lotId) {
  const lot = await prisma.inventoryLot.findUnique({ where: { id: lotId } });
  return dec(lot.currentQty);
}

function rollbackDbWrapper() {
  let allocationCreates = 0;
  return {
    $transaction(callback, options) {
      return prisma.$transaction((tx) => {
        const wrappedTx = new Proxy(tx, {
          get(target, prop) {
            if (prop === "orderStockLotAllocation") {
              return {
                ...target.orderStockLotAllocation,
                create(args) {
                  allocationCreates += 1;
                  return target.orderStockLotAllocation.create(args).then((value) => {
                    if (allocationCreates === 1) {
                      throw new Error(`${PREFIX}ROLLBACK_AFTER_INTERMEDIATE_ALLOCATION`);
                    }
                    return value;
                  });
                }
              };
            }
            return target[prop];
          }
        });
        return callback(wrappedTx);
      }, options);
    }
  };
}

async function testReservationLifecycle(category) {
  const product = await createProduct(category, "RESERVA_PRODUCT", "10");
  const recipeName = `${PREFIX}RESERVA_RECIPE`;
  await createRecipe(recipeName, product, "2");
  await createLot(product, "RESERVA_LOT", "10", { expiresAt: new Date("2026-12-31T00:00:00.000Z") });
  const order = await createOrder("ORDER_RESERVA_ACTIVA", recipeName, 1);

  const stockBefore = await productStock(product.id);
  const reservation = await reserveOrderStock(order.id, TEST_USER_ID);
  await assert(reservation.status === "ACTIVA", "A. Crear reserva nueva crea reserva ACTIVA");
  await assert(reservation.items.length === 1, "A. Crear reserva nueva crea reservation items");
  await assert(reservation.items[0].allocations.length === 1, "A. Crear reserva nueva crea allocations");
  await assert((await productStock(product.id)).equals(stockBefore), "A. Crear reserva nueva no modifica stock fisico");

  const allocationsBefore = await countOrderAllocations(order.id);
  const sameReservation = await reserveOrderStock(order.id, TEST_USER_ID);
  const allocationsAfter = await countOrderAllocations(order.id);
  const reservationCount = await prisma.orderStockReservation.count({ where: { orderId: order.id } });
  await assert(sameReservation.id === reservation.id, "B. Reservar nuevamente ACTIVA devuelve la misma reserva");
  await assert(reservationCount === 1, "B. Reservar nuevamente ACTIVA mantiene COUNT reservas orderId = 1");
  await assert(allocationsBefore === allocationsAfter, "B. Reservar nuevamente ACTIVA no duplica allocations");
  await assert((await productStock(product.id)).equals(stockBefore), "B. Reservar nuevamente ACTIVA no modifica stock");

  await consumeOrderReservation(order.id, order.code, TEST_USER_ID);
  const consumedStock = await productStock(product.id);
  const consumedAllocationCount = await countOrderAllocations(order.id);
  await assertRejects(() => reserveOrderStock(order.id, TEST_USER_ID), "C. Reservar CONSUMIDA rechaza explicitamente", "ya ha sido procesado");
  await assert(await prisma.orderStockReservation.count({ where: { orderId: order.id } }) === 1, "C. Reservar CONSUMIDA no crea nueva reserva");
  await assert(await countOrderAllocations(order.id) === consumedAllocationCount, "C. Reservar CONSUMIDA no crea allocations");
  await assert((await productStock(product.id)).equals(consumedStock), "C. Reservar CONSUMIDA no cambia stock");

  const releaseProduct = await createProduct(category, "LIBERADA_PRODUCT", "10");
  const releaseRecipeName = `${PREFIX}LIBERADA_RECIPE`;
  await createRecipe(releaseRecipeName, releaseProduct, "2");
  await createLot(releaseProduct, "LIBERADA_LOT", "10", { expiresAt: new Date("2026-12-31T00:00:00.000Z") });
  const releaseOrder = await createOrder("ORDER_LIBERADA", releaseRecipeName, 1);
  const releaseReservation = await reserveOrderStock(releaseOrder.id, TEST_USER_ID);
  const releaseStockBefore = await productStock(releaseProduct.id);
  await releaseOrderReservation(releaseOrder.id);
  await assertRejects(() => reserveOrderStock(releaseOrder.id, TEST_USER_ID), "D. Reservar LIBERADA rechaza explicitamente", "liberado");
  await assert(await prisma.orderStockReservation.count({ where: { orderId: releaseOrder.id } }) === 1, "D. Reservar LIBERADA conserva reserva original");
  await assert((await getReservation(releaseOrder.id)).id === releaseReservation.id, "D. Reservar LIBERADA no elimina ni recrea");
  await assert((await productStock(releaseProduct.id)).equals(releaseStockBefore), "D. Reservar LIBERADA no cambia stock");
}

async function testConsumptionLifecycle(category) {
  const product = await createProduct(category, "CONSUMO_PRODUCT", "10");
  const recipeName = `${PREFIX}CONSUMO_RECIPE`;
  await createRecipe(recipeName, product, "3");
  const lot = await createLot(product, "CONSUMO_LOT", "10", { expiresAt: new Date("2026-12-31T00:00:00.000Z") });
  const order = await createOrder("ORDER_CONSUMO", recipeName, 1);
  const reservation = await reserveOrderStock(order.id, TEST_USER_ID);
  const allocationId = reservation.items[0].allocations[0].id;

  const consumed = await consumeOrderReservation(order.id, order.code, TEST_USER_ID);
  await assert(consumed.status === "CONSUMIDA", "E. Consumir ACTIVA cambia ACTIVA a CONSUMIDA");
  await assert(eqDecimal(await lotQty(lot.id), "7"), "E. Consumir ACTIVA descuenta InventoryLot.currentQty segun allocation existente");
  await assert(eqDecimal(await productStock(product.id), "7"), "E. Consumir ACTIVA descuenta Product.stock");
  await assert(await prisma.inventoryMovement.count({ where: { allocationId } }) === 1, "E. Consumir ACTIVA crea InventoryMovement");

  const lotAfterFirstConsume = await lotQty(lot.id);
  const productAfterFirstConsume = await productStock(product.id);
  const movementsAfterFirstConsume = await prisma.inventoryMovement.count({ where: { allocationId } });
  const consumedAgain = await consumeOrderReservation(order.id, order.code, TEST_USER_ID);
  await assert(consumedAgain.status === "CONSUMIDA", "F. Consumir CONSUMIDA nuevamente retorna estado coherente");
  await assert((await lotQty(lot.id)).equals(lotAfterFirstConsume), "F. Consumir CONSUMIDA no vuelve a descontar lote");
  await assert((await productStock(product.id)).equals(productAfterFirstConsume), "F. Consumir CONSUMIDA no vuelve a descontar producto");
  await assert(await prisma.inventoryMovement.count({ where: { allocationId } }) === movementsAfterFirstConsume, "F. Consumir CONSUMIDA no crea movimiento duplicado");

  const releasedProduct = await createProduct(category, "CONSUMO_LIBERADA_PRODUCT", "10");
  const releasedRecipeName = `${PREFIX}CONSUMO_LIBERADA_RECIPE`;
  await createRecipe(releasedRecipeName, releasedProduct, "2");
  const releasedLot = await createLot(releasedProduct, "CONSUMO_LIBERADA_LOT", "10", { expiresAt: new Date("2026-12-31T00:00:00.000Z") });
  const releasedOrder = await createOrder("ORDER_CONSUMO_LIBERADA", releasedRecipeName, 1);
  await reserveOrderStock(releasedOrder.id, TEST_USER_ID);
  await releaseOrderReservation(releasedOrder.id);
  const releasedLotBefore = await lotQty(releasedLot.id);
  const releasedProductBefore = await productStock(releasedProduct.id);
  const movementCountBefore = await prisma.inventoryMovement.count({ where: { productId: releasedProduct.id } });
  await assertRejects(() => consumeOrderReservation(releasedOrder.id, releasedOrder.code, TEST_USER_ID), "G. Consumir LIBERADA rechaza explicitamente", "liberado");
  await assert((await lotQty(releasedLot.id)).equals(releasedLotBefore), "G. Consumir LIBERADA no cambia lote");
  await assert((await productStock(releasedProduct.id)).equals(releasedProductBefore), "G. Consumir LIBERADA no cambia producto");
  await assert(await prisma.inventoryMovement.count({ where: { productId: releasedProduct.id } }) === movementCountBefore, "G. Consumir LIBERADA no crea movimiento");
}

async function testReleaseLifecycle(category) {
  const product = await createProduct(category, "LIBERAR_PRODUCT", "10");
  const recipeName = `${PREFIX}LIBERAR_RECIPE`;
  await createRecipe(recipeName, product, "2");
  const lot = await createLot(product, "LIBERAR_LOT", "10", { expiresAt: new Date("2026-12-31T00:00:00.000Z") });
  const order = await createOrder("ORDER_LIBERAR", recipeName, 1);
  const reservation = await reserveOrderStock(order.id, TEST_USER_ID);
  const allocationCount = await countOrderAllocations(order.id);
  const lotBefore = await lotQty(lot.id);
  const productBefore = await productStock(product.id);

  const released = await releaseOrderReservation(order.id);
  await assert(reservation.status === "ACTIVA" && released.status === "LIBERADA", "H. Liberar ACTIVA cambia ACTIVA a LIBERADA");
  await assert((await lotQty(lot.id)).equals(lotBefore), "H. Liberar ACTIVA no modifica lote fisico");
  await assert((await productStock(product.id)).equals(productBefore), "H. Liberar ACTIVA no modifica stock fisico");
  await assert(await countOrderAllocations(order.id) === allocationCount, "H. Liberar ACTIVA conserva allocations historicas");

  const releasedAgain = await releaseOrderReservation(order.id);
  await assert(releasedAgain.status === "LIBERADA", "I. Liberar LIBERADA nuevamente es idempotente");
  await assert(await countOrderAllocations(order.id) === allocationCount, "I. Liberar LIBERADA no tiene efectos secundarios");

  const consumedProduct = await createProduct(category, "LIBERAR_CONSUMIDA_PRODUCT", "10");
  const consumedRecipeName = `${PREFIX}LIBERAR_CONSUMIDA_RECIPE`;
  await createRecipe(consumedRecipeName, consumedProduct, "2");
  const consumedLot = await createLot(consumedProduct, "LIBERAR_CONSUMIDA_LOT", "10", { expiresAt: new Date("2026-12-31T00:00:00.000Z") });
  const consumedOrder = await createOrder("ORDER_LIBERAR_CONSUMIDA", consumedRecipeName, 1);
  await reserveOrderStock(consumedOrder.id, TEST_USER_ID);
  await consumeOrderReservation(consumedOrder.id, consumedOrder.code, TEST_USER_ID);
  const consumedLotBefore = await lotQty(consumedLot.id);
  const consumedProductBefore = await productStock(consumedProduct.id);
  const movementCountBefore = await prisma.inventoryMovement.count({ where: { productId: consumedProduct.id } });
  await assertRejects(() => releaseOrderReservation(consumedOrder.id), "J. Liberar CONSUMIDA rechaza explicitamente", "ya ha sido consumido");
  await assert((await lotQty(consumedLot.id)).equals(consumedLotBefore), "J. Liberar CONSUMIDA no modifica lote");
  await assert((await productStock(consumedProduct.id)).equals(consumedProductBefore), "J. Liberar CONSUMIDA no modifica stock");
  await assert(await prisma.inventoryMovement.count({ where: { productId: consumedProduct.id } }) === movementCountBefore, "J. Liberar CONSUMIDA no modifica movimientos");
}

async function testFefo(category) {
  const product = await createProduct(category, "FEFO_PRODUCT", "20");
  const today = getLimaStartOfDayUTC(new Date("2026-08-21T12:00:00.000Z"));
  const yesterday = getLimaStartOfDayUTC(new Date("2026-08-20T12:00:00.000Z"));
  const tomorrow = getLimaStartOfDayUTC(new Date("2026-08-22T12:00:00.000Z"));

  const expired = await createLot(product, "FEFO_EXPIRED", "5", { expiresAt: yesterday, receivedAt: new Date("2026-08-01T00:00:00.000Z") });
  const future = await createLot(product, "FEFO_FUTURE", "5", { expiresAt: tomorrow, receivedAt: new Date("2026-08-01T00:00:00.000Z") });
  const todayLot = await createLot(product, "FEFO_TODAY", "5", { expiresAt: today, receivedAt: new Date("2026-08-01T00:00:00.000Z") });
  const noExpiry = await createLot(product, "FEFO_NO_EXPIRY", "5", { expiresAt: null, receivedAt: new Date("2026-07-01T00:00:00.000Z") });
  const orderedLots = await getAvailableLotsForProduct(product.id, prisma, new Date("2026-08-21T12:00:00.000Z"));
  const orderedIds = orderedLots.map((item) => item.id);
  await assert(!orderedIds.includes(expired.id), "K. FEFO excluye lote vencido", `lote ${expired.id}`);
  await assert(orderedIds.includes(todayLot.id), "L. FEFO incluye lote que vence HOY", `lote ${todayLot.id}`);
  await assert(orderedIds.includes(future.id), "M. FEFO incluye lote futuro", `lote ${future.id}`);
  await assert(orderedIds[orderedIds.length - 1] === noExpiry.id, "N. FEFO pone lote sin vencimiento al final", `lote ${noExpiry.id}`);
  await assert(orderedIds[0] === todayLot.id && orderedIds[1] === future.id, "FEFO orden exacto expiresAt ASC y NULL al final", orderedIds.join(","));

  const tieReceivedProduct = await createProduct(category, "FEFO_TIE_RECEIVED_PRODUCT", "10");
  const sameExpiry = new Date("2026-09-01T00:00:00.000Z");
  const laterReceived = await createLot(tieReceivedProduct, "FEFO_TIE_RECEIVED_LATER", "5", { expiresAt: sameExpiry, receivedAt: new Date("2026-08-15T00:00:00.000Z") });
  const earlierReceived = await createLot(tieReceivedProduct, "FEFO_TIE_RECEIVED_EARLIER", "5", { expiresAt: sameExpiry, receivedAt: new Date("2026-08-01T00:00:00.000Z") });
  const receivedOrder = await getAvailableLotsForProduct(tieReceivedProduct.id, prisma, new Date("2026-08-21T12:00:00.000Z"));
  await assert(receivedOrder[0].id === earlierReceived.id, "O. FEFO usa receivedAt ASC con mismo expiresAt", `eligio ${receivedOrder[0].id}, no ${laterReceived.id}`);

  const tieIdProduct = await createProduct(category, "FEFO_TIE_ID_PRODUCT", "10");
  const sameReceived = new Date("2026-08-01T00:00:00.000Z");
  const lowerIdLot = await createLot(tieIdProduct, "FEFO_TIE_ID_LOWER", "5", { expiresAt: sameExpiry, receivedAt: sameReceived });
  const higherIdLot = await createLot(tieIdProduct, "FEFO_TIE_ID_HIGHER", "5", { expiresAt: sameExpiry, receivedAt: sameReceived });
  const idOrder = await getAvailableLotsForProduct(tieIdProduct.id, prisma, new Date("2026-08-21T12:00:00.000Z"));
  await assert(idOrder[0].id === lowerIdLot.id && idOrder[1].id === higherIdLot.id, "P. FEFO usa id ASC con mismo expiresAt y receivedAt", `${idOrder[0].id},${idOrder[1].id}`);

  const limaNow = new Date("2026-08-22T02:00:00.000Z");
  const limaCommercialDate = getLimaStartOfDayUTC(limaNow);
  const limaProduct = await createProduct(category, "FEFO_LIMA_DATE_PRODUCT", "1");
  const limaLot = await createLot(limaProduct, "FEFO_LIMA_DATE_LOT", "1", { expiresAt: limaCommercialDate, receivedAt: sameReceived });
  const limaLots = await getAvailableLotsForProduct(limaProduct.id, prisma, limaNow);
  await assert(limaLots[0]?.id === limaLot.id, "Fecha comercial America/Lima mantiene vigente lote 2026-08-21 a las 2026-08-22T02:00Z", `lote ${limaLot.id}`);
}

async function testConcurrency(category) {
  const product = await createProduct(category, "CONCURRENCY_PRODUCT", "10");
  const recipeName = `${PREFIX}CONCURRENCY_RECIPE`;
  await createRecipe(recipeName, product, "7");
  const lot = await createLot(product, "CONCURRENCY_LOT_10", "10", { expiresAt: new Date("2026-12-31T00:00:00.000Z") });
  const orderA = await createOrder("ORDER_CONCURRENCY_A", recipeName, 1);
  const orderB = await createOrder("ORDER_CONCURRENCY_B", recipeName, 1);

  const settled = await Promise.allSettled([
    reserveOrderStock(orderA.id, TEST_USER_ID),
    reserveOrderStock(orderB.id, TEST_USER_ID)
  ]);
  const fulfilled = settled.filter((item) => item.status === "fulfilled");
  const rejected = settled.filter((item) => item.status === "rejected");
  await assert(fulfilled.length === 1, "Concurrencia 10 / 7 + 7: exactamente 1 fulfilled", JSON.stringify(settled.map((item) => item.status)));
  await assert(rejected.length === 1, "Concurrencia 10 / 7 + 7: exactamente 1 rejected", rejected[0]?.reason?.message || "");

  const activeAllocated = await prisma.orderStockLotAllocation.aggregate({
    where: { inventoryLotId: lot.id, reservationItem: { reservation: { status: "ACTIVA" } } },
    _sum: { quantity: true }
  });
  await assert(dec(activeAllocated._sum.quantity).lte(lot.currentQty), "Concurrencia 10 / 7 + 7: nunca quedan 14 reservados");
  const fulfilledOrderId = fulfilled[0].value.orderId;
  const failedOrderId = fulfilledOrderId === orderA.id ? orderB.id : orderA.id;
  await assert(await prisma.orderStockReservation.count({ where: { orderId: failedOrderId } }) === 0, "Concurrencia 10 / 7 + 7: el pedido fallido no deja reserva parcial");
  await assert(await countOrderAllocations(failedOrderId) === 0, "Concurrencia 10 / 7 + 7: no quedan allocations parciales del fallido");
}

async function testRollback(category) {
  const product = await createProduct(category, "ROLLBACK_PRODUCT", "10");
  const recipeName = `${PREFIX}ROLLBACK_RECIPE`;
  await createRecipe(recipeName, product, "8");
  const lotA = await createLot(product, "ROLLBACK_LOT_A", "5", { expiresAt: new Date("2026-09-01T00:00:00.000Z"), receivedAt: new Date("2026-08-01T00:00:00.000Z") });
  const lotB = await createLot(product, "ROLLBACK_LOT_B", "5", { expiresAt: new Date("2026-10-01T00:00:00.000Z"), receivedAt: new Date("2026-08-02T00:00:00.000Z") });
  const order = await createOrder("ORDER_ROLLBACK", recipeName, 1);

  const productBefore = await productStock(product.id);
  const lotABefore = await lotQty(lotA.id);
  const lotBBefore = await lotQty(lotB.id);
  const movementBefore = await prisma.inventoryMovement.count({ where: { productId: product.id } });
  const reservationBefore = await getReservation(order.id);

  await assertRejects(
    () => reserveOrderStock(order.id, TEST_USER_ID, rollbackDbWrapper()),
    "Rollback transaccional: falla controlada durante transaccion despues de operacion intermedia",
    `${PREFIX}ROLLBACK_AFTER_INTERMEDIATE_ALLOCATION`
  );
  await assert((await getReservation(order.id))?.status === reservationBefore?.status, "Rollback: estado de reserva queda igual al anterior");
  await assert((await productStock(product.id)).equals(productBefore), "Rollback: Product.stock queda igual");
  await assert((await lotQty(lotA.id)).equals(lotABefore) && (await lotQty(lotB.id)).equals(lotBBefore), "Rollback: InventoryLot.currentQty queda igual en todos los lotes");
  await assert(await prisma.inventoryMovement.count({ where: { productId: product.id } }) === movementBefore, "Rollback: InventoryMovement sin parciales");
  await assert(await countOrderAllocations(order.id) === 0, "Rollback: allocations sin residuos indebidos");
}

async function testDecimalsAndHistoricalRecipe(category) {
  let sum = dec(0);
  for (let index = 0; index < 100; index += 1) sum = sum.plus("0.005");
  await assert(sum.equals("0.500"), "Q. Prisma.Decimal 0.005 sumado 100 veces = 0.5000 exacto", sum.toFixed(4));
  await assert(dec("20.0000").minus("14.4325").equals("5.5675"), "R. Prisma.Decimal 20.0000 - 14.4325 = 5.5675 exacto");

  const product = await createProduct(category, "DECIMAL_5G_PRODUCT", "1");
  const recipeName = `${PREFIX}DECIMAL_5G_RECIPE`;
  await createRecipe(recipeName, product, "5", "g");
  const lot = await createLot(product, "DECIMAL_5G_LOT", "1", { expiresAt: new Date("2026-12-31T00:00:00.000Z") });
  const order = await createOrder("ORDER_DECIMAL_5G", recipeName, 1);
  const plan = await buildOrderRecipePlan(order.id);
  await assert(eqDecimal(plan.requirements[0].required, "0.0050"), "S. 5g -> buildOrderRecipePlan produce 0.0050 kg exacto");
  const reservation = await reserveOrderStock(order.id, TEST_USER_ID);
  const item = reservation.items[0];
  const allocation = item.allocations[0];
  await assert(eqDecimal(item.quantity, "0.0050"), "S. 5g -> OrderStockReservationItem persiste 0.0050");
  await assert(eqDecimal(allocation.quantity, "0.0050"), "S. 5g -> OrderStockLotAllocation persiste 0.0050");
  await consumeOrderReservation(order.id, order.code, TEST_USER_ID);
  const movement = await prisma.inventoryMovement.findUnique({ where: { allocationId: allocation.id } });
  await assert(eqDecimal(movement.quantity, "0.0050"), "S. 5g -> InventoryMovement registra 0.0050");
  await assert(eqDecimal(await lotQty(lot.id), "0.9950"), "S. 5g -> InventoryLot.currentQty queda 0.9950");
  await assert(eqDecimal(await productStock(product.id), "0.9950"), "S. 5g -> Product.stock queda 0.9950");

  const roundProduct = await createProduct(category, "ROUND_PRODUCT", "1");
  const roundRecipeName = `${PREFIX}ROUND_RECIPE`;
  await createRecipe(roundRecipeName, roundProduct, "0.12345", "kg");
  await createLot(roundProduct, "ROUND_LOT", "1", { expiresAt: new Date("2026-12-31T00:00:00.000Z") });
  const roundOrder = await createOrder("ORDER_ROUND", roundRecipeName, 1);
  const roundReservation = await reserveOrderStock(roundOrder.id, TEST_USER_ID);
  await assert(eqDecimal(roundReservation.items[0].quantity, "0.1235"), "T. ROUND_HALF_UP persiste 0.12345 como 0.1235");

  const historicalProduct = await createProduct(category, "HISTORICAL_PRODUCT", "10");
  const historicalRecipeName = `${PREFIX}HISTORICAL_RECIPE`;
  const historicalRecipe = await createRecipe(historicalRecipeName, historicalProduct, "1.2500", "kg");
  await createLot(historicalProduct, "HISTORICAL_LOT", "10", { expiresAt: new Date("2026-12-31T00:00:00.000Z") });
  const historicalOrder = await createOrder("ORDER_HISTORICAL_RECIPE", historicalRecipeName, 2);
  const historicalReservation = await reserveOrderStock(historicalOrder.id, TEST_USER_ID);
  const historicalItemBefore = historicalReservation.items[0];
  await prisma.recipeItem.updateMany({ where: { recipeId: historicalRecipe.id }, data: { quantity: qty("9.9999") } });
  const historicalItemAfter = await prisma.orderStockReservationItem.findUnique({ where: { id: historicalItemBefore.id } });
  const sources = historicalItemAfter.sourcesJson || JSON.parse(historicalItemAfter.source);
  const source = sources[0];
  await assert(source.orderItemId === historicalOrder.items[0].id, "Receta historica conserva orderItemId");
  await assert(source.recipeId === historicalRecipe.id, "Receta historica conserva recipeId");
  await assert(source.recipeName === historicalRecipeName, "Receta historica conserva recipeName");
  await assert(source.orderedQuantity === 2, "Receta historica conserva orderedQuantity");
  await assert(source.ingredientProductId === historicalProduct.id, "Receta historica conserva ingredientProductId");
  await assert(source.ingredientName === historicalProduct.name, "Receta historica conserva ingredientName");
  await assert(eqDecimal(source.quantityPerUnit, "1.2500"), "Receta historica conserva quantityPerUnit");
  await assert(source.recipeUnit === "kg", "Receta historica conserva recipeUnit");
  await assert(eqDecimal(source.requiredQty, "2.5000"), "Receta historica conserva requiredQty");
  await assert(source.requiredUnit === "kg", "Receta historica conserva requiredUnit");
}

async function testInvariants() {
  const products = await prisma.product.findMany({
    where: { name: { startsWith: PREFIX } },
    include: { inventoryLots: true }
  });
  for (const product of products) {
    const sumLots = product.inventoryLots.reduce((sum, lot) => sum.plus(lot.currentQty), dec(0));
    await assert(dec(product.stock).equals(sumLots), `INVARIANTE A Product.stock = SUM(InventoryLot.currentQty) para ${product.name}`, sumLots.toFixed(4));
  }

  const negativeLots = await prisma.inventoryLot.count({ where: { product: { name: { startsWith: PREFIX } }, currentQty: { lt: 0 } } });
  await assert(negativeLots === 0, "INVARIANTE B InventoryLot.currentQty >= 0");

  const lotForConstraint = await prisma.inventoryLot.findFirst({ where: { product: { name: { startsWith: PREFIX } } } });
  const silentPrisma = new PrismaClient({ log: [] });
  try {
    try {
      await silentPrisma.$executeRaw`UPDATE "InventoryLot" SET "currentQty" = -1 WHERE id = ${lotForConstraint.id}`;
      throw new Error("PostgreSQL permitio currentQty negativa");
    } catch (error) {
      await assert(
        (error?.message || "").includes("InventoryLot_currentQty_check"),
        "INVARIANTE B PostgreSQL rechaza UPDATE directo a cantidad negativa",
        "constraint InventoryLot_currentQty_check"
      );
    }
  } finally {
    await silentPrisma.$disconnect();
  }

  const activeAllocations = await prisma.orderStockLotAllocation.groupBy({
    by: ["inventoryLotId"],
    where: {
      inventoryLot: { product: { name: { startsWith: PREFIX } } },
      reservationItem: { reservation: { status: "ACTIVA" } }
    },
    _sum: { quantity: true }
  });
  for (const row of activeAllocations) {
    const lot = await prisma.inventoryLot.findUnique({ where: { id: row.inventoryLotId } });
    await assert(dec(row._sum.quantity).lte(lot.currentQty), `INVARIANTE C allocations ACTIVA <= currentQty lote ${lot.code}`);
  }

  const duplicateMovements = await prisma.$queryRaw`
    SELECT "allocationId", COUNT(*)::int AS count
    FROM "InventoryMovement"
    WHERE "allocationId" IS NOT NULL
    GROUP BY "allocationId"
    HAVING COUNT(*) > 1
  `;
  await assert(duplicateMovements.length === 0, "INVARIANTE D cada OrderStockLotAllocation genera como maximo 1 InventoryMovement");
}

async function run() {
  console.log("=== FASE 3 INVENTARIO - SUITE FEFO FINAL ===");
  let exitCode = 0;
  try {
    await cleanup();
    const category = await ensureCategory();
    await testReservationLifecycle(category);
    await testConsumptionLifecycle(category);
    await testReleaseLifecycle(category);
    await testFefo(category);
    await testConcurrency(category);
    await testRollback(category);
    await testDecimalsAndHistoricalRecipe(category);
    await testInvariants();
  } catch (error) {
    exitCode = 1;
    console.error("\nSUITE FALLIDA");
    console.error(error);
  } finally {
    try {
      await cleanup();
    } catch (cleanupError) {
      exitCode = 1;
      console.error("Fallo durante limpieza segura:", cleanupError);
    }
    await prisma.$disconnect();
    console.log("\n=== RESUMEN TEST-FEFO ===");
    for (const result of results) {
      console.log(`${result.status} | ${result.name}${result.detail ? ` | ${result.detail}` : ""}`);
    }
    process.exit(exitCode);
  }
}

run();
