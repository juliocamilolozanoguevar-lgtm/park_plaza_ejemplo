import { Prisma } from "@prisma/client";
import "./src/config/env.js";
import { prisma } from "./src/config/prisma.js";
import { registerInventoryAdjustment } from "./src/services/inventory-adjustment.service.js";
import { getAvailableLotsForProduct } from "./src/services/inventory-lot.service.js";

const PREFIX = "ZZTEST_F43_";
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
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.product.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.category.deleteMany({ where: { name: `${PREFIX}CATEGORY` } });
}

async function ensureCategory() {
  return prisma.category.upsert({
    where: { name: `${PREFIX}CATEGORY` },
    update: {},
    create: { name: `${PREFIX}CATEGORY`, description: "Categoria aislada para pruebas Fase 4.3" }
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
      initialQty: qty(options.initialQty || lotQty),
      currentQty: qty(lotQty),
      unitCost: money(options.unitCost || product.cost),
      receivedAt: options.receivedAt || new Date(),
      expiresAt: options.expiresAt === undefined ? dateFromToday(30) : options.expiresAt,
      active: options.active !== undefined ? options.active : true
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
    include: { inventoryLot: true, createdBy: true }
  });
}

async function movementCount(productId, reference) {
  return prisma.inventoryMovement.count({ where: { productId, reference } });
}

async function run() {
  await cleanup();
  const category = await ensureCategory();
  const user = await ensureUser();

  const productA = await createProduct(category, "A_NEGATIVE", "10.0000", "kg", "8.50");
  const lotA = await createLot(productA, "A_LOT", "5.0000", { unitCost: "8.50" });
  await createLot(productA, "A_OTHER", "5.0000", { unitCost: "8.50" });
  const resultA = await registerInventoryAdjustment({
    productId: productA.id,
    inventoryLotId: lotA.id,
    quantity: "4.7000",
    expectedLotQty: "5.0000",
    reason: `${PREFIX}conteo negativo`,
    reference: `${PREFIX}A_NEGATIVE`
  }, user.id);
  await assert(eq(await lotQty(lotA.id), "4.7000"), "A/L. Ajuste negativo deja InventoryLot.currentQty = countedQty");
  await assert(eq(await productStock(productA.id), "9.7000"), "K. Product.stock disminuye correctamente");
  await assertStockMatchesLots(productA.id, "W. Product.stock = SUM(lotes) tras ajuste negativo");
  await assert(resultA.movement.inventoryLotId === lotA.id, "M. InventoryMovement.inventoryLotId correcto");
  await assert(eq(resultA.movement.beforeQty, "10.0000") && eq(resultA.movement.afterQty, "9.7000"), "N. beforeQty / afterQty correctos en ajuste negativo");
  await assert(eq(resultA.movement.quantity, "0.3000"), "O. quantity = ABS(difference) en ajuste negativo");
  await assert(eq(resultA.movement.unitCost, "8.50"), "P. unitCost = InventoryLot.unitCost");
  await assert(resultA.movement.reason === `${PREFIX}conteo negativo`, "Q. reason conservado");
  await assert(resultA.movement.reference === `${PREFIX}A_NEGATIVE`, "R. reference conservado");
  await assert(resultA.movement.createdById === user.id, "S. createdById conservado");

  const productB = await createProduct(category, "B_POSITIVE", "5.0000", "kg", "4.20");
  const lotB = await createLot(productB, "B_LOT", "5.0000", { unitCost: "4.20" });
  const resultB = await registerInventoryAdjustment({
    productId: productB.id,
    inventoryLotId: lotB.id,
    countedQty: "5.2500",
    expectedLotQty: "5.0000",
    reason: `${PREFIX}conteo positivo`,
    reference: `${PREFIX}B_POSITIVE`
  }, user.id);
  await assert(eq(await lotQty(lotB.id), "5.2500"), "B/L. Ajuste positivo actualiza el lote");
  await assert(eq(await productStock(productB.id), "5.2500"), "J. Product.stock aumenta correctamente");
  await assert(eq(resultB.movement.quantity, "0.2500"), "O. quantity = ABS(difference) en ajuste positivo");
  await assertStockMatchesLots(productB.id, "W. Product.stock = SUM(lotes) tras ajuste positivo");

  const productC = await createProduct(category, "C_ZERO", "2.0000", "kg", "3.00");
  const lotC = await createLot(productC, "C_LOT", "2.0000");
  await registerInventoryAdjustment({
    productId: productC.id,
    inventoryLotId: lotC.id,
    countedQty: "0.0000",
    expectedLotQty: "2.0000",
    reason: `${PREFIX}conteo cero`,
    reference: `${PREFIX}C_ZERO`
  }, user.id);
  await assert(eq(await lotQty(lotC.id), "0.0000") && eq(await productStock(productC.id), "0.0000"), "C. countedQty = 0 permitido y aplicado");

  const productD = await createProduct(category, "D_SMALL", "0.0100", "kg", "2.00");
  const lotD = await createLot(productD, "D_LOT", "0.0100");
  const resultD = await registerInventoryAdjustment({
    productId: productD.id,
    inventoryLotId: lotD.id,
    quantity: "0.0050",
    expectedLotQty: "0.0100",
    reason: `${PREFIX}decimal`,
    reference: `${PREFIX}D_SMALL`
  }, user.id);
  await assert(eq(await lotQty(lotD.id), "0.0050") && eq(resultD.movement.quantity, "0.0050"), "D. countedQty = 0.0050 se conserva exactamente");

  const productE1 = await createProduct(category, "E_PRODUCT_A", "1.0000");
  const productE2 = await createProduct(category, "E_PRODUCT_B", "1.0000");
  await createLot(productE1, "E_LOT_PRODUCT_A", "1.0000");
  const lotE = await createLot(productE2, "E_LOT_OTHER", "1.0000");
  await assertRejects(
    () => registerInventoryAdjustment({ productId: productE1.id, inventoryLotId: lotE.id, countedQty: "0.5000", expectedLotQty: "1.0000", reason: `${PREFIX}lote incorrecto`, reference: `${PREFIX}E_WRONG_PRODUCT` }, user.id),
    "E. Lote incorrecto para producto rechazado",
    "no pertenece"
  );

  const productF = await createProduct(category, "F_MISSING_LOT", "1.0000");
  await createLot(productF, "F_LOT", "1.0000");
  await assertRejects(
    () => registerInventoryAdjustment({ productId: productF.id, inventoryLotId: 999999999, countedQty: "0.5000", expectedLotQty: "1.0000", reason: `${PREFIX}lote inexistente`, reference: `${PREFIX}F_MISSING_LOT` }, user.id),
    "F. Lote inexistente rechazado",
    "Lote no encontrado"
  );

  const productG = await createProduct(category, "G_NEGATIVE_QTY", "1.0000");
  const lotG = await createLot(productG, "G_LOT", "1.0000");
  await assertRejects(
    () => registerInventoryAdjustment({ productId: productG.id, inventoryLotId: lotG.id, countedQty: "-0.1000", expectedLotQty: "1.0000", reason: `${PREFIX}negativo`, reference: `${PREFIX}G_NEGATIVE_QTY` }, user.id),
    "G. countedQty negativo rechazado",
    "no puede ser negativo"
  );

  const productH = await createProduct(category, "H_EXPIRED", "3.0000");
  const lotH = await createLot(productH, "H_EXPIRED_LOT", "3.0000", { expiresAt: dateFromToday(-2) });
  await registerInventoryAdjustment({ productId: productH.id, inventoryLotId: lotH.id, countedQty: "2.5000", expectedLotQty: "3.0000", reason: `${PREFIX}vencido`, reference: `${PREFIX}H_EXPIRED` }, user.id);
  await assert(eq(await lotQty(lotH.id), "2.5000"), "H. Lote vencido ajustable manualmente");

  const productI = await createProduct(category, "I_INACTIVE", "2.0000");
  const lotI = await createLot(productI, "I_INACTIVE_LOT", "2.0000", { active: false });
  await assertRejects(
    () => registerInventoryAdjustment({ productId: productI.id, inventoryLotId: lotI.id, countedQty: "1.0000", expectedLotQty: "2.0000", reason: `${PREFIX}inactivo`, reference: `${PREFIX}I_INACTIVE` }, user.id),
    "I. Lote inactivo rechazado",
    "inactivo"
  );

  const productT = await createProduct(category, "T_NO_CHANGE", "4.0000");
  const lotT = await createLot(productT, "T_LOT", "4.0000");
  const resultT = await registerInventoryAdjustment({ productId: productT.id, inventoryLotId: lotT.id, countedQty: "4.0000", expectedLotQty: "4.0000", reason: `${PREFIX}sin diferencia`, reference: `${PREFIX}T_NO_CHANGE` }, user.id);
  await assert(resultT.noChange === true && !resultT.movement, "T. difference = 0 no crea movimiento");
  await assert(await movementCount(productT.id, `${PREFIX}T_NO_CHANGE`) === 0, "T. Sin diferencia no deja InventoryMovement");

  const productU = await createProduct(category, "U_ROLLBACK", "5.0000");
  const lotU = await createLot(productU, "U_LOT", "5.0000");
  await assertRejects(
    () => registerInventoryAdjustment({ productId: productU.id, inventoryLotId: lotU.id, countedQty: "4.5000", expectedLotQty: "5.0000", reason: `${PREFIX}rollback`, reference: `${PREFIX}U_ROLLBACK` }, 999999999),
    "U. Rollback completo ante fallo intermedio"
  );
  await assert(eq(await lotQty(lotU.id), "5.0000") && eq(await productStock(productU.id), "5.0000"), "U. Rollback conserva lote y Product.stock");
  await assert(await movementCount(productU.id, `${PREFIX}U_ROLLBACK`) === 0, "U. Rollback no deja movimiento parcial");

  const productV = await createProduct(category, "V_CONCURRENCY", "5.0000");
  const lotV = await createLot(productV, "V_LOT", "5.0000");
  const concurrent = await Promise.allSettled([
    registerInventoryAdjustment({ productId: productV.id, inventoryLotId: lotV.id, countedQty: "4.7000", expectedLotQty: "5.0000", reason: `${PREFIX}concurrente-a`, reference: `${PREFIX}V_CONCURRENCY_A` }, user.id),
    registerInventoryAdjustment({ productId: productV.id, inventoryLotId: lotV.id, countedQty: "4.9000", expectedLotQty: "5.0000", reason: `${PREFIX}concurrente-b`, reference: `${PREFIX}V_CONCURRENCY_B` }, user.id)
  ]);
  const fulfilled = concurrent.filter((item) => item.status === "fulfilled");
  const rejected = concurrent.filter((item) => item.status === "rejected");
  await assert(fulfilled.length === 1 && rejected.length === 1, "V. Concurrencia con expectedLotQty deja una operacion exitosa y una rechazada");
  await assertStockMatchesLots(productV.id, "W. Product.stock = SUM(lotes) tras concurrencia");
  const concurrentMovements = await prisma.inventoryMovement.count({
    where: { productId: productV.id, reference: { in: [`${PREFIX}V_CONCURRENCY_A`, `${PREFIX}V_CONCURRENCY_B`] } }
  });
  await assert(concurrentMovements === 1, "V. Ajuste concurrente rechazado no deja movimiento parcial");

  const productX = await createProduct(category, "X_FEFO_UNCHANGED", "6.0000");
  const lateLot = await createLot(productX, "X_LATE", "3.0000", { expiresAt: dateFromToday(30), receivedAt: dateFromToday(-3) });
  const earlyLot = await createLot(productX, "X_EARLY", "3.0000", { expiresAt: dateFromToday(5), receivedAt: dateFromToday(-1) });
  const fefoLots = await getAvailableLotsForProduct(productX.id);
  await assert(fefoLots[0].id === earlyLot.id && fefoLots[1].id === lateLot.id, "X. FEFO no se modifica por ajustes manuales");

  const allTestProducts = await prisma.product.findMany({
    where: { name: { startsWith: PREFIX } },
    include: { inventoryLots: true }
  });
  for (const product of allTestProducts) {
    const lotsSum = product.inventoryLots.reduce((sum, lot) => sum.plus(lot.currentQty), dec(0));
    await assert(dec(product.stock).equals(lotsSum), `W. Invariante final para ${product.name}`, lotsSum.toFixed(4));
  }

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
