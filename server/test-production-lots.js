import { Prisma } from "@prisma/client";
import "./src/config/env.js";
import { prisma } from "./src/config/prisma.js";
import { createProduction } from "./src/services/production.service.js";
import { getAvailableLotsForProduct } from "./src/services/inventory-lot.service.js";

const PREFIX = "ZZTEST_F41_";
const AREA = "RESTAURANTE";
const TEST_USER_ID = null;
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
  await prisma.product.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.category.deleteMany({ where: { name: `${PREFIX}CATEGORY` } });
}

async function ensureCategory() {
  return prisma.category.upsert({
    where: { name: `${PREFIX}CATEGORY` },
    update: {},
    create: { name: `${PREFIX}CATEGORY`, description: "Categoria aislada para pruebas Fase 4.1" }
  });
}

async function createProduct(category, suffix, stock = "0", unit = "kg", cost = "10.00") {
  return prisma.product.create({
    data: {
      name: `${PREFIX}${suffix}`,
      categoryId: category.id,
      area: AREA,
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

async function movementsForProduction(productionId, productId = undefined) {
  return prisma.inventoryMovement.findMany({
    where: {
      reference: { startsWith: `PRODUCCION:${productionId}:` },
      productId
    },
    orderBy: { id: "asc" },
    include: { inventoryLot: true }
  });
}

async function createProductionPair(category, suffix, inputStock = "0", outputStock = "0") {
  const input = await createProduct(category, `${suffix}_INPUT`, inputStock, "kg", "7.50");
  const output = await createProduct(category, `${suffix}_OUTPUT`, outputStock, "kg", "15.00");
  return { input, output };
}

function isFinalProductionCode(code) {
  return /^PROD-\d{4}-\d{6}$/.test(code);
}

async function getNextProductionId() {
  const rows = await prisma.$queryRaw`
    SELECT last_value, is_called
    FROM "ProductionBatch_id_seq"
  `;
  const row = rows[0];
  return Number(row.is_called ? BigInt(row.last_value) + 1n : BigInt(row.last_value));
}

async function run() {
  await cleanup();
  const category = await ensureCategory();

  const pairA = await createProductionPair(category, "A_SINGLE", "5", "0");
  const lotA = await createLot(pairA.input, "A_LOT", "5");
  const prodA = await createProduction({ inputProductId: pairA.input.id, outputProductId: pairA.output.id, inputQty: "5.0000", outputQty: "4.1500", notes: `${PREFIX}A` }, TEST_USER_ID);
  await assert(eq(await lotQty(lotA.id), "0"), "A. Produccion con un solo lote descuenta InventoryLot.currentQty");
  await assert(eq(await productStock(pairA.input.id), "0"), "A. Produccion con un solo lote descuenta Product.stock");
  await assert(eq(await productStock(pairA.output.id), "4.1500"), "A. Producto resultante aumenta Product.stock");
  await assertStockMatchesLots(pairA.input.id, "Q. Insumo mantiene Product.stock = SUM(lotes) tras produccion simple");
  await assertStockMatchesLots(pairA.output.id, "Q. Output mantiene Product.stock = SUM(lotes) tras produccion simple");
  const movementsA = await movementsForProduction(prodA.id);
  await assert(movementsA.every((movement) => movement.inventoryLotId), "J. Todo movimiento fisico de Produccion tiene inventoryLotId");
  await assert(movementsA.some((movement) => movement.type === "ENTRADA" && movement.inventoryLot?.code === `PROD-${prodA.id}`), "M. Movimiento ENTRADA referencia el lote producido");

  const pairB = await createProductionPair(category, "B_MULTI", "11", "0");
  const lotB1 = await createLot(pairB.input, "B_LOT_1", "3", { receivedAt: dateFromToday(-5), expiresAt: dateFromToday(10) });
  const lotB2 = await createLot(pairB.input, "B_LOT_2", "8", { receivedAt: dateFromToday(-4), expiresAt: dateFromToday(20) });
  const prodB = await createProduction({ inputProductId: pairB.input.id, outputProductId: pairB.output.id, inputQty: "7.0000", outputQty: "6.0000", notes: `${PREFIX}B` }, TEST_USER_ID);
  await assert(eq(await lotQty(lotB1.id), "0"), "B. Produccion con varios lotes agota el primer lote");
  await assert(eq(await lotQty(lotB2.id), "4"), "B. Produccion con varios lotes consume saldo del segundo lote");
  const outputLotB = await prisma.inventoryLot.findUnique({ where: { code: `PROD-${prodB.id}` } });
  await assert(outputLotB && eq(outputLotB.currentQty, "6"), "K. Producto resultante crea InventoryLot con currentQty correcto");
  await assertStockMatchesLots(pairB.input.id, "Q. Insumo mantiene Product.stock = SUM(lotes) tras multiples lotes");

  const pairC = await createProductionPair(category, "C_FEFO", "12", "0");
  const lateLot = await createLot(pairC.input, "C_LATE", "5", { receivedAt: dateFromToday(-10), expiresAt: dateFromToday(50) });
  const earlyLot = await createLot(pairC.input, "C_EARLY", "7", { receivedAt: dateFromToday(-1), expiresAt: dateFromToday(5) });
  const fefoLots = await getAvailableLotsForProduct(pairC.input.id);
  await assert(fefoLots[0].id === earlyLot.id && fefoLots[1].id === lateLot.id, "C. FEFO ordena por expiresAt ASC, receivedAt ASC, id ASC");
  await createProduction({ inputProductId: pairC.input.id, outputProductId: pairC.output.id, inputQty: "6.0000", outputQty: "5.0000", notes: `${PREFIX}C` }, TEST_USER_ID);
  await assert(eq(await lotQty(earlyLot.id), "1"), "C. FEFO consume primero el lote que vence antes");
  await assert(eq(await lotQty(lateLot.id), "5"), "C. FEFO no consume lote posterior si no es necesario");

  const pairD = await createProductionPair(category, "D_EXPIRED", "11", "0");
  await createLot(pairD.input, "D_EXPIRED_LOT", "10", { expiresAt: dateFromToday(-1) });
  await createLot(pairD.input, "D_VALID_LOT", "1", { expiresAt: dateFromToday(10) });
  await assertRejects(
    () => createProduction({ inputProductId: pairD.input.id, outputProductId: pairD.output.id, inputQty: "2.0000", outputQty: "1.5000", notes: `${PREFIX}D` }, TEST_USER_ID),
    "D. Lote vencido se excluye de disponibilidad",
    "Stock insuficiente"
  );

  const pairE = await createProductionPair(category, "E_INSUFFICIENT", "2", "0");
  await createLot(pairE.input, "E_LOT", "2");
  await assertRejects(
    () => createProduction({ inputProductId: pairE.input.id, outputProductId: pairE.output.id, inputQty: "3.0000", outputQty: "2.0000", notes: `${PREFIX}E` }, TEST_USER_ID),
    "E. Stock insuficiente por lotes rechaza produccion",
    "Stock insuficiente"
  );

  const pairN = await createProductionPair(category, "N_WASTE", "5", "0");
  await createLot(pairN.input, "N_LOT", "5");
  const prodN = await createProduction({ inputProductId: pairN.input.id, outputProductId: pairN.output.id, inputQty: "5.0000", outputQty: "4.1500", notes: `${PREFIX}N` }, TEST_USER_ID);
  const outN = await movementsForProduction(prodN.id, pairN.input.id);
  const sumOutN = outN.reduce((sum, movement) => sum.plus(movement.quantity), dec(0));
  const sumWasteN = outN.filter((movement) => movement.origin === "MERMA").reduce((sum, movement) => sum.plus(movement.quantity), dec(0));
  await assert(sumOutN.equals(qty("5")), "O. Suma de salidas fisicas del insumo = inputQty");
  await assert(sumWasteN.equals(qty("0.8500")), "N. Merma no genera doble descuento y conserva wasteQty");

  const pairR = await createProductionPair(category, "R_SMALL", "0.0100", "0");
  await createLot(pairR.input, "R_LOT", "0.0100");
  const prodR = await createProduction({ inputProductId: pairR.input.id, outputProductId: pairR.output.id, inputQty: "0.0050", outputQty: "0.0040", notes: `${PREFIX}R` }, TEST_USER_ID);
  await assert(eq(prodR.inputQty, "0.0050") && eq(prodR.outputQty, "0.0040") && eq(prodR.wasteQty, "0.0010"), "R. Cantidad pequena 0.0050 no se pierde en ProductionBatch");
  await assert(eq(await lotQty((await prisma.inventoryLot.findUnique({ where: { code: `PROD-${prodR.id}` } })).id), "0.0040"), "H. Prisma.Decimal mantiene precision de lote producido");

  const pairP = await createProductionPair(category, "P_ROLLBACK", "5", "0");
  const rollbackLot = await createLot(pairP.input, "P_LOT", "5");
  const rollbackOutputBefore = await productStock(pairP.output.id);
  const nextProductionId = await getNextProductionId();
  await createLot(pairP.output, `COLLISION_OUTPUT_${nextProductionId}`, "0", { expiresAt: null });
  await prisma.inventoryLot.update({
    where: { code: `${PREFIX}COLLISION_OUTPUT_${nextProductionId}` },
    data: { code: `PROD-${nextProductionId}` }
  });
  await assertRejects(
    () => createProduction({ inputProductId: pairP.input.id, outputProductId: pairP.output.id, inputQty: "5.0000", outputQty: "4.0000", notes: `${PREFIX}P` }, TEST_USER_ID),
    "P. Rollback completo si falla despues del primer descuento",
    "Unique constraint"
  );
  await assert(eq(await lotQty(rollbackLot.id), "5"), "P. Rollback conserva InventoryLot.currentQty original");
  await assert(eq(await productStock(pairP.input.id), "5"), "P. Rollback conserva Product.stock del insumo");
  await assert((await productStock(pairP.output.id)).equals(rollbackOutputBefore), "P. Rollback conserva Product.stock del output");

  const pairCC1 = await createProductionPair(category, "CC_ONE", "8", "0");
  const pairCC2 = await createProductionPair(category, "CC_TWO", "8", "0");
  await createLot(pairCC1.input, "CC_ONE_LOT", "8");
  await createLot(pairCC2.input, "CC_TWO_LOT", "8");
  const concurrentResults = await Promise.allSettled([
    createProduction({ inputProductId: pairCC1.input.id, outputProductId: pairCC1.output.id, inputQty: "3.0000", outputQty: "2.5000", notes: `${PREFIX}CC_ONE` }, TEST_USER_ID),
    createProduction({ inputProductId: pairCC2.input.id, outputProductId: pairCC2.output.id, inputQty: "3.0000", outputQty: "2.5000", notes: `${PREFIX}CC_TWO` }, TEST_USER_ID)
  ]);
  await assert(concurrentResults.every((result) => result.status === "fulfilled"), "CC. Dos producciones concurrentes validas terminan fulfilled", JSON.stringify(concurrentResults.map((result) => result.status)));
  const [concurrentA, concurrentB] = concurrentResults.map((result) => result.value);
  await assert(concurrentA.id !== concurrentB.id, "CC. Producciones concurrentes tienen ProductionBatch distinto");
  await assert(concurrentA.code !== concurrentB.code, "CC. Producciones concurrentes tienen code distinto", `${concurrentA.code}, ${concurrentB.code}`);
  await assert(isFinalProductionCode(concurrentA.code) && isFinalProductionCode(concurrentB.code), "CC. Codigos concurrentes respetan formato final", `${concurrentA.code}, ${concurrentB.code}`);
  await assert(
    Boolean(await prisma.inventoryLot.findUnique({ where: { code: `PROD-${concurrentA.id}` } }))
      && Boolean(await prisma.inventoryLot.findUnique({ where: { code: `PROD-${concurrentB.id}` } })),
    "CC. Producciones concurrentes crean correctamente su lote de salida"
  );
  await assertStockMatchesLots(pairCC1.input.id, "CC. Produccion concurrente 1 mantiene Product.stock = SUM(lotes)");
  await assertStockMatchesLots(pairCC1.output.id, "CC. Output concurrente 1 mantiene Product.stock = SUM(lotes)");
  await assertStockMatchesLots(pairCC2.input.id, "CC. Produccion concurrente 2 mantiene Product.stock = SUM(lotes)");
  await assertStockMatchesLots(pairCC2.output.id, "CC. Output concurrente 2 mantiene Product.stock = SUM(lotes)");
  console.log(`CONCURRENT_CODES=${concurrentA.code},${concurrentB.code}`);

  const negativeLots = await prisma.inventoryLot.count({ where: { product: { name: { startsWith: PREFIX } }, currentQty: { lt: 0 } } });
  const negativeProducts = await prisma.product.count({ where: { name: { startsWith: PREFIX }, stock: { lt: 0 } } });
  await assert(negativeLots === 0, "F. InventoryLot.currentQty nunca negativo");
  await assert(negativeProducts === 0, "G. Product.stock nunca negativo");
  await assertStockMatchesLots(pairR.input.id, "Q. Product.stock = SUM(InventoryLot.currentQty) despues de cantidad pequena");
}

try {
  await run();
  console.log("\nResumen Fase 4.1:");
  for (const result of results) console.log(`${result.status} - ${result.name}${result.detail ? ` (${result.detail})` : ""}`);
  await cleanup();
  console.log("\nFASE 4.1 TESTS OK");
  await prisma.$disconnect();
  process.exit(0);
} catch (error) {
  console.error("\nFASE 4.1 TESTS FAIL");
  console.error(error);
  try {
    await cleanup();
  } finally {
    await prisma.$disconnect();
  }
  process.exit(1);
}
