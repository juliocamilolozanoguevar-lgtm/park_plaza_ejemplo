import { Prisma } from "@prisma/client";
import "./src/config/env.js";
import { prisma } from "./src/config/prisma.js";
import { registerInventoryExit } from "./src/services/inventory-exit.service.js";

const PREFIX = "ZZTEST_INV_EXIT_";
const AREA = "RESTAURANTE";

const dec = (value) => new Prisma.Decimal(value || 0);
const qty = (value) => dec(value).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
const money = (value) => dec(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
const eq = (actual, expected) => dec(actual).equals(dec(expected));

async function assert(condition, name, detail = "") {
  if (!condition) throw new Error(`${name}${detail ? `: ${detail}` : ""}`);
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

function dateFromToday(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(0, 0, 0, 0);
  return date;
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
  await prisma.inventoryLot.deleteMany({ where: { OR: [{ code: { startsWith: PREFIX } }, { product: { name: { startsWith: PREFIX } } }] } });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.product.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.category.deleteMany({ where: { name: `${PREFIX}CATEGORY` } });
}

async function ensureCategory() {
  return prisma.category.upsert({
    where: { name: `${PREFIX}CATEGORY` },
    update: {},
    create: { name: `${PREFIX}CATEGORY`, description: "Categoria aislada para pruebas de salidas" }
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

async function productStock(productId) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  return dec(product.stock);
}

async function lotQty(lotId) {
  const lot = await prisma.inventoryLot.findUnique({ where: { id: lotId } });
  return dec(lot.currentQty);
}

async function movementsFor(productId, reference) {
  return prisma.inventoryMovement.findMany({ where: { productId, reference }, orderBy: { id: "asc" }, include: { inventoryLot: true } });
}

async function assertStockMatchesLots(productId, name) {
  const product = await prisma.product.findUnique({ where: { id: productId }, include: { inventoryLots: true } });
  const lotsSum = product.inventoryLots.reduce((sum, lot) => sum.plus(lot.currentQty), dec(0));
  await assert(dec(product.stock).equals(lotsSum), name, `stock=${dec(product.stock).toFixed(4)} lotes=${lotsSum.toFixed(4)}`);
}

async function run() {
  await cleanup();
  const category = await ensureCategory();
  const user = await ensureUser();

  const productA = await createProduct(category, "A_EXPLICIT", "10.0000", "kg", "9.00");
  const lotA = await createLot(productA, "A_LOT", "10.0000", { unitCost: "12.30" });
  const resultA = await registerInventoryExit({ productId: productA.id, inventoryLotId: lotA.id, quantity: "2.5000", reason: `${PREFIX}operativo`, reference: `${PREFIX}A_EXPLICIT` }, user.id);
  await assert(eq(await lotQty(lotA.id), "7.5000"), "A. Salida explicita descuenta InventoryLot.currentQty");
  await assert(eq(await productStock(productA.id), "7.5000"), "A. Salida explicita descuenta Product.stock");
  await assert(resultA.movements.length === 1 && resultA.movements[0].inventoryLotId === lotA.id, "J. Movimiento explicito guarda inventoryLotId");
  await assert(eq(resultA.movements[0].unitCost, "12.30"), "K. unitCost correcto por lote explicito");
  await assert(eq(resultA.movements[0].beforeQty, "10.0000") && eq(resultA.movements[0].afterQty, "7.5000"), "L. beforeQty/afterQty correctos");
  await assertStockMatchesLots(productA.id, "P. Invariante tras salida explicita");

  const productB = await createProduct(category, "B_FEFO", "12.0000");
  const lotB2 = await createLot(productB, "B_LATE", "8.0000", { expiresAt: dateFromToday(30), receivedAt: dateFromToday(-5) });
  const lotB1 = await createLot(productB, "B_EARLY", "4.0000", { expiresAt: dateFromToday(5), receivedAt: dateFromToday(-1) });
  await registerInventoryExit({ productId: productB.id, quantity: "3.0000", reason: `${PREFIX}fefo`, reference: `${PREFIX}B_FEFO` }, user.id);
  await assert(eq(await lotQty(lotB1.id), "1.0000") && eq(await lotQty(lotB2.id), "8.0000"), "B. Salida sin lote usa FEFO");
  await assertStockMatchesLots(productB.id, "P. Invariante tras FEFO");

  const productC = await createProduct(category, "C_MULTI", "11.0000");
  const lotC1 = await createLot(productC, "C_FIRST", "3.0000", { expiresAt: dateFromToday(4) });
  const lotC2 = await createLot(productC, "C_SECOND", "8.0000", { expiresAt: dateFromToday(8) });
  await registerInventoryExit({ productId: productC.id, quantity: "7.0000", reason: `${PREFIX}multi`, reference: `${PREFIX}C_MULTI` }, user.id);
  const movementsC = await movementsFor(productC.id, `${PREFIX}C_MULTI`);
  await assert(eq(await lotQty(lotC1.id), "0.0000") && eq(await lotQty(lotC2.id), "4.0000"), "C. Salida FEFO distribuida en varios lotes");
  await assert(movementsC.length === 2 && movementsC.every((item) => item.inventoryLotId), "J. Cada salida distribuida guarda lote");

  const productD = await createProduct(category, "D_INSUFFICIENT_LOT", "5.0000");
  const lotD = await createLot(productD, "D_LOT", "1.0000");
  await assertRejects(() => registerInventoryExit({ productId: productD.id, inventoryLotId: lotD.id, quantity: "2.0000", reason: `${PREFIX}insuficiente` }, user.id), "D. Lote explicito insuficiente", "Stock insuficiente");

  const productE = await createProduct(category, "E_INSUFFICIENT_GLOBAL", "1.0000");
  await createLot(productE, "E_LOT", "1.0000");
  await assertRejects(() => registerInventoryExit({ productId: productE.id, quantity: "2.0000", reason: `${PREFIX}global` }, user.id), "E. Stock global insuficiente", "Stock insuficiente");

  const productF1 = await createProduct(category, "F_PRODUCT_A", "1.0000");
  await createLot(productF1, "F_OWN_LOT", "1.0000");
  const productF2 = await createProduct(category, "F_PRODUCT_B", "1.0000");
  const lotF = await createLot(productF2, "F_LOT", "1.0000");
  await assertRejects(() => registerInventoryExit({ productId: productF1.id, inventoryLotId: lotF.id, quantity: "1.0000", reason: `${PREFIX}incorrecto` }, user.id), "F. Lote incorrecto", "no pertenece");

  await assertRejects(() => registerInventoryExit({ productId: productF2.id, inventoryLotId: 999999999, quantity: "1.0000", reason: `${PREFIX}inexistente` }, user.id), "G. Lote inexistente", "Lote no encontrado");

  const productH = await createProduct(category, "H_INACTIVE", "1.0000");
  const lotH = await createLot(productH, "H_LOT", "1.0000", { active: false });
  await assertRejects(() => registerInventoryExit({ productId: productH.id, inventoryLotId: lotH.id, quantity: "1.0000", reason: `${PREFIX}inactivo` }, user.id), "H. Lote inactivo", "no esta activo");

  const productI = await createProduct(category, "I_DECIMAL", "0.0100");
  const lotI = await createLot(productI, "I_LOT", "0.0100");
  const resultI = await registerInventoryExit({ productId: productI.id, quantity: "0.0050", reason: `${PREFIX}decimal`, reference: `${PREFIX}I_DECIMAL` }, user.id);
  await assert(eq(resultI.movements[0].quantity, "0.0050") && eq(await lotQty(lotI.id), "0.0050"), "I. Decimal 0.0050 se conserva");

  const productM = await createProduct(category, "M_ROLLBACK", "5.0000");
  const lotM = await createLot(productM, "M_LOT", "5.0000");
  await assertRejects(() => registerInventoryExit({ productId: productM.id, inventoryLotId: lotM.id, quantity: "2.0000", reason: `${PREFIX}rollback`, reference: `${PREFIX}M_ROLLBACK` }, 999999999), "M. Rollback por usuario invalido", "Usuario no autorizado");
  await assert(eq(await productStock(productM.id), "5.0000") && eq(await lotQty(lotM.id), "5.0000"), "M. Rollback no descuenta stock ni lote");
  await assert((await movementsFor(productM.id, `${PREFIX}M_ROLLBACK`)).length === 0, "M. Rollback no crea movimientos");

  const productN = await createProduct(category, "N_CONCURRENCY", "5.0000");
  await createLot(productN, "N_LOT", "5.0000");
  const concurrent = await Promise.allSettled([
    registerInventoryExit({ productId: productN.id, quantity: "3.0000", reason: `${PREFIX}concurrente-a`, reference: `${PREFIX}N_A` }, user.id),
    registerInventoryExit({ productId: productN.id, quantity: "3.0000", reason: `${PREFIX}concurrente-b`, reference: `${PREFIX}N_B` }, user.id)
  ]);
  await assert(concurrent.filter((item) => item.status === "fulfilled").length === 1, "N. Concurrencia deja una salida exitosa");
  await assert(eq(await productStock(productN.id), "2.0000"), "N. Concurrencia protege Product.stock");
  await assertStockMatchesLots(productN.id, "P. Invariante tras concurrencia");

  const productO = await createProduct(category, "O_EXPIRED", "6.0000");
  const lotOExpired = await createLot(productO, "O_EXPIRED_LOT", "5.0000", { expiresAt: dateFromToday(-2) });
  const lotOValid = await createLot(productO, "O_VALID_LOT", "1.0000", { expiresAt: dateFromToday(10) });
  await assertRejects(() => registerInventoryExit({ productId: productO.id, quantity: "2.0000", reason: `${PREFIX}vencido`, reference: `${PREFIX}O_EXPIRED` }, user.id), "O. FEFO no usa vencidos", "Stock insuficiente");
  await assert(eq(await lotQty(lotOExpired.id), "5.0000") && eq(await lotQty(lotOValid.id), "1.0000"), "O. Rechazo por vencidos no altera lotes");

  console.log("\nFASE 4 FINAL - TEST INVENTORY EXITS OK");
}

run()
  .catch((error) => {
    console.error("\nFASE 4 FINAL - TEST INVENTORY EXITS FAIL");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
