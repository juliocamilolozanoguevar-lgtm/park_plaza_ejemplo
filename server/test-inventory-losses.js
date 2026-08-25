import { Prisma } from "@prisma/client";
import "./src/config/env.js";
import { prisma } from "./src/config/prisma.js";
import { registerInventoryLoss } from "./src/services/inventory-loss.service.js";
import { createProduction } from "./src/services/production.service.js";

const PREFIX = "ZZTEST_F42_";
const AREA = "RESTAURANTE";
const results = [];

const dec = (value) => new Prisma.Decimal(value || 0);
const qty = (value) => dec(value).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
const money = (value) => dec(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
const eq = (actual, expected) => dec(actual).equals(dec(expected));

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
        { reason: { contains: PREFIX } },
        { reference: { contains: PREFIX } },
        { inventoryLot: { code: { startsWith: PREFIX } } },
        { inventoryLot: { code: { startsWith: "PROD-" }, product: { name: { startsWith: PREFIX } } } },
        { product: { name: { startsWith: PREFIX } } }
      ]
    }
  });
  await prisma.inventoryLot.deleteMany({
    where: {
      OR: [
        { code: { startsWith: PREFIX } },
        { product: { name: { startsWith: PREFIX } } }
      ]
    }
  });
  await prisma.productionBatch.deleteMany({
    where: {
      OR: [
        { notes: { contains: PREFIX } },
        { inputProduct: { name: { startsWith: PREFIX } } },
        { outputProduct: { name: { startsWith: PREFIX } } }
      ]
    }
  });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.product.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.category.deleteMany({ where: { name: `${PREFIX}CATEGORY` } });
}

async function ensureCategory() {
  return prisma.category.upsert({
    where: { name: `${PREFIX}CATEGORY` },
    update: {},
    create: { name: `${PREFIX}CATEGORY`, description: "Categoria aislada para pruebas Fase 4.2" }
  });
}

async function ensureUser() {
  const role = await prisma.role.upsert({
    where: { name: "ADMINISTRADOR" },
    update: {},
    create: { name: "ADMINISTRADOR", description: "Administrador" }
  });

  return prisma.user.create({
    data: {
      firstName: `${PREFIX}USER`,
      lastName: "Inventario",
      email: `${PREFIX}user@parkplaza.test`,
      documentNumber: `${PREFIX}DOC`,
      username: `${PREFIX}user`,
      passwordHash: `${PREFIX}hash`,
      roleId: role.id
    }
  });
}

async function createProduct(category, suffix, stock = "0", unit = "kg", cost = "10.00", area = AREA) {
  return prisma.product.create({
    data: {
      name: `${PREFIX}${suffix}`,
      categoryId: category.id,
      area,
      unit,
      stock: qty(stock),
      minStock: qty("0"),
      cost: money(cost),
      price: money("20")
    }
  });
}

function dateFromToday(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

async function createLot(product, suffix, lotQty, options = {}) {
  return prisma.inventoryLot.create({
    data: {
      productId: product.id,
      code: `${PREFIX}${suffix}`,
      initialQty: qty(lotQty),
      currentQty: qty(lotQty),
      unitCost: money(options.unitCost || product.cost),
      receivedAt: options.receivedAt || new Date(),
      expiresAt: options.expiresAt === undefined ? dateFromToday(30) : options.expiresAt
    }
  });
}

async function lotQty(id) {
  const lot = await prisma.inventoryLot.findUnique({ where: { id } });
  return dec(lot.currentQty);
}

async function productStock(id) {
  const product = await prisma.product.findUnique({ where: { id } });
  return dec(product.stock);
}

async function assertStockMatchesLots(productId, name) {
  const product = await prisma.product.findUnique({ where: { id: productId }, include: { inventoryLots: true } });
  const lotsSum = product.inventoryLots.reduce((sum, lot) => sum.plus(lot.currentQty), dec(0));
  await assert(dec(product.stock).equals(lotsSum), name, `stock=${dec(product.stock).toFixed(4)} lotes=${lotsSum.toFixed(4)}`);
}

async function movementsFor(productId, reference) {
  return prisma.inventoryMovement.findMany({
    where: { productId, reference },
    orderBy: { id: "asc" },
    include: { inventoryLot: true, product: true, createdBy: true }
  });
}

async function movementCount(productId, reference) {
  return prisma.inventoryMovement.count({ where: { productId, reference } });
}

async function createProductionPair(category, suffix, inputStock = "0", outputStock = "0") {
  const input = await createProduct(category, `${suffix}_INPUT`, inputStock, "kg", "7.50");
  const output = await createProduct(category, `${suffix}_OUTPUT`, outputStock, "kg", "15.00");
  return { input, output };
}

async function run() {
  await cleanup();
  const category = await ensureCategory();
  const user = await ensureUser();

  const productA = await createProduct(category, "A_EXPLICIT", "10.0000", "kg", "9.00");
  const lotA = await createLot(productA, "A_LOT", "10.0000", { unitCost: "12.30" });
  const resultA = await registerInventoryLoss({
    productId: productA.id,
    inventoryLotId: lotA.id,
    quantity: "2.5000",
    reason: `${PREFIX}rotura`,
    reference: `${PREFIX}A_EXPLICIT`
  }, user.id);
  await assert(eq(await lotQty(lotA.id), "7.5000"), "A. Perdida con lote explicito descuenta InventoryLot.currentQty");
  await assert(eq(await productStock(productA.id), "7.5000"), "A. Perdida con lote explicito descuenta Product.stock");
  await assert(resultA.movements.length === 1 && resultA.movements[0].inventoryLotId === lotA.id, "I. Movimiento de perdida explicita guarda inventoryLotId");
  await assert(eq(resultA.movements[0].unitCost, "12.30"), "J. unitCost viene del InventoryLot explicito");
  await assert(resultA.movements[0].reason === `${PREFIX}rotura`, "K. reason se conserva");
  await assert(resultA.movements[0].reference === `${PREFIX}A_EXPLICIT`, "L. reference se conserva");
  await assert(resultA.movements[0].createdById === user.id, "M. createdById se conserva cuando existe usuario");
  await assert(resultA.movements[0].product.area === AREA, "N. Area se reconstruye desde Product.area");
  await assertStockMatchesLots(productA.id, "R. Stock global coincide con suma de lotes tras lote explicito");

  const productB = await createProduct(category, "B_FEFO", "12.0000", "kg", "8.00");
  const lotB2 = await createLot(productB, "B_LATE", "8.0000", { receivedAt: dateFromToday(-5), expiresAt: dateFromToday(30), unitCost: "8.80" });
  const lotB1 = await createLot(productB, "B_EARLY", "4.0000", { receivedAt: dateFromToday(-1), expiresAt: dateFromToday(5), unitCost: "7.70" });
  await registerInventoryLoss({ productId: productB.id, quantity: "3.0000", reason: `${PREFIX}deterioro`, reference: `${PREFIX}B_FEFO` }, user.id);
  await assert(eq(await lotQty(lotB1.id), "1.0000"), "B. Perdida sin lote usa FEFO y consume lote que vence antes");
  await assert(eq(await lotQty(lotB2.id), "8.0000"), "B. FEFO no consume lote posterior si no es necesario");
  await assertStockMatchesLots(productB.id, "R. Stock global coincide con suma de lotes tras FEFO");

  const productC = await createProduct(category, "C_MULTI", "11.0000", "kg", "6.00");
  const lotC1 = await createLot(productC, "C_FIRST", "3.0000", { expiresAt: dateFromToday(4), unitCost: "6.10" });
  const lotC2 = await createLot(productC, "C_SECOND", "8.0000", { expiresAt: dateFromToday(8), unitCost: "6.20" });
  await registerInventoryLoss({ productId: productC.id, quantity: "7.0000", reason: `${PREFIX}derrame`, reference: `${PREFIX}C_MULTI` }, user.id);
  const movementsC = await movementsFor(productC.id, `${PREFIX}C_MULTI`);
  await assert(eq(await lotQty(lotC1.id), "0.0000") && eq(await lotQty(lotC2.id), "4.0000"), "C. Perdida se distribuye entre varios lotes");
  await assert(movementsC.length === 2, "H. Se crea un InventoryMovement por cada lote afectado");
  await assert(movementsC.every((movement) => movement.inventoryLotId), "I. Todos los movimientos por perdida tienen inventoryLotId");

  const productD = await createProduct(category, "D_EXPIRED", "6.0000", "kg", "5.00");
  const lotDExpired = await createLot(productD, "D_EXPIRED_LOT", "5.0000", { expiresAt: dateFromToday(-2) });
  const lotDValid = await createLot(productD, "D_VALID_LOT", "1.0000", { expiresAt: dateFromToday(10) });
  await assertRejects(
    () => registerInventoryLoss({ productId: productD.id, quantity: "2.0000", reason: `${PREFIX}vencimiento`, reference: `${PREFIX}D_EXPIRED` }, user.id),
    "D. Lote vencido no se selecciona automaticamente",
    "Stock insuficiente"
  );
  await assert(eq(await lotQty(lotDExpired.id), "5.0000") && eq(await lotQty(lotDValid.id), "1.0000"), "D. Rechazo por vencimiento no altera lotes");

  const productE = await createProduct(category, "E_INSUFFICIENT", "1.0000", "kg", "4.00");
  const lotE = await createLot(productE, "E_LOT", "1.0000");
  await assertRejects(
    () => registerInventoryLoss({ productId: productE.id, quantity: "2.0000", reason: `${PREFIX}insuficiente`, reference: `${PREFIX}E_INSUFFICIENT` }, user.id),
    "E. Cantidad insuficiente rechazada",
    "Stock insuficiente"
  );
  await assert(eq(await lotQty(lotE.id), "1.0000") && eq(await productStock(productE.id), "1.0000"), "F/G. Rechazo mantiene InventoryLot.currentQty y Product.stock no negativos");
  await assert(await movementCount(productE.id, `${PREFIX}E_INSUFFICIENT`) === 0, "E. Operacion rechazada no deja movimientos parciales");

  const productO = await createProduct(category, "O_SMALL", "0.0100", "kg", "3.00");
  const lotO = await createLot(productO, "O_LOT", "0.0100");
  const resultO = await registerInventoryLoss({ productId: productO.id, quantity: "0.0050", reason: `${PREFIX}decimal`, reference: `${PREFIX}O_SMALL` }, user.id);
  await assert(eq(resultO.movements[0].quantity, "0.0050") && eq(await lotQty(lotO.id), "0.0050"), "O. Cantidad pequena 0.0050 se conserva exactamente");
  await assertStockMatchesLots(productO.id, "R. Stock global coincide con suma de lotes tras cantidad pequena");

  const productP = await createProduct(category, "P_ROLLBACK", "5.0000", "kg", "2.00");
  const lotP = await createLot(productP, "P_LOT", "5.0000");
  await assertRejects(
    () => registerInventoryLoss({ productId: productP.id, quantity: "2.0000", reason: `${PREFIX}rollback`, reference: `${PREFIX}P_ROLLBACK` }, 999999999),
    "P. Rollback completo ante fallo intermedio"
  );
  await assert(eq(await lotQty(lotP.id), "5.0000"), "P. Rollback restaura InventoryLot.currentQty");
  await assert(eq(await productStock(productP.id), "5.0000"), "P. Rollback restaura Product.stock");
  await assert(await movementCount(productP.id, `${PREFIX}P_ROLLBACK`) === 0, "P. Rollback no deja movimientos parciales");

  const productQ = await createProduct(category, "Q_CONCURRENCY", "5.0000", "kg", "2.00");
  const lotQ = await createLot(productQ, "Q_LOT", "5.0000");
  const concurrent = await Promise.allSettled([
    registerInventoryLoss({ productId: productQ.id, quantity: "3.0000", reason: `${PREFIX}concurrente-a`, reference: `${PREFIX}Q_CONCURRENCY_A` }, user.id),
    registerInventoryLoss({ productId: productQ.id, quantity: "3.0000", reason: `${PREFIX}concurrente-b`, reference: `${PREFIX}Q_CONCURRENCY_B` }, user.id)
  ]);
  const fulfilled = concurrent.filter((item) => item.status === "fulfilled");
  const rejected = concurrent.filter((item) => item.status === "rejected");
  await assert(fulfilled.length === 1 && rejected.length === 1, "Q. Concurrencia real deja exactamente una perdida exitosa y una rechazada");
  await assert(eq(await lotQty(lotQ.id), "2.0000") && eq(await productStock(productQ.id), "2.0000"), "Q. Concurrencia no genera cantidades negativas");
  await assertStockMatchesLots(productQ.id, "R. Product.stock = SUM(InventoryLot.currentQty) tras concurrencia");
  const concurrentMovements = await prisma.inventoryMovement.count({
    where: { productId: productQ.id, reference: { in: [`${PREFIX}Q_CONCURRENCY_A`, `${PREFIX}Q_CONCURRENCY_B`] } }
  });
  await assert(concurrentMovements === 1, "Q. Operacion concurrente fallida no deja movimiento parcial");

  const pairS = await createProductionPair(category, "S_PRODUCTION", "5.0000", "0.0000");
  await createLot(pairS.input, "S_LOT", "5.0000");
  const production = await createProduction({
    inputProductId: pairS.input.id,
    outputProductId: pairS.output.id,
    inputQty: "5.0000",
    outputQty: "4.1500",
    notes: `${PREFIX}S`
  }, user.id);
  const stockAfterProduction = await productStock(pairS.input.id);
  const lotSumAfterProduction = await prisma.inventoryLot.findMany({ where: { productId: pairS.input.id } });
  const lotSum = lotSumAfterProduction.reduce((sum, lot) => sum.plus(lot.currentQty), dec(0));
  const productionWasteMovement = await prisma.inventoryMovement.findFirst({
    where: { productId: pairS.input.id, origin: "MERMA", reference: `PRODUCCION:${production.id}:MERMA` }
  });
  await assert(Boolean(productionWasteMovement), "S. Existe movimiento de merma de Produccion con referencia PRODUCCION:{id}:MERMA");
  await assertRejects(
    () => registerInventoryLoss({
      productId: pairS.input.id,
      quantity: "0.8500",
      reason: `${PREFIX}no-reprocesar-produccion`,
      reference: `PRODUCCION:${production.id}:MERMA`
    }, user.id),
    "S. Merma de Produccion no se vuelve a descontar",
    "no debe reprocesarse"
  );
  await assert(eq(await productStock(pairS.input.id), stockAfterProduction) && dec(stockAfterProduction).equals(lotSum), "S/R. Stock de produccion no cambia por intento de reproceso");

  console.log(`\n${results.length} comprobaciones completadas.`);
}

run()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup().catch((error) => console.error("Error en limpieza:", error));
    await prisma.$disconnect();
  });
