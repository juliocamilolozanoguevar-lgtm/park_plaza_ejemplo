import { Prisma } from "@prisma/client";
import "./src/config/env.js";
import { prisma } from "./src/config/prisma.js";
import { getAvailableLotsForProduct } from "./src/services/inventory-lot.service.js";
import { listInspections, retainForReview, resolveInspection } from "./src/services/inventory-inspection.service.js";

const PREFIX = "ZZTEST_F44B_";
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
  await prisma.inventoryInspection.deleteMany({
    where: {
      OR: [
        { reason: { contains: PREFIX } },
        { reference: { contains: PREFIX } },
        { product: { name: { startsWith: PREFIX } } },
        { inventoryLot: { code: { startsWith: PREFIX } } }
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
    create: { name: `${PREFIX}CATEGORY`, description: "Categoria aislada para pruebas Fase 4.4B" }
  });
}

async function ensureUser(suffix = "USER") {
  const role = await prisma.role.upsert({
    where: { name: "ADMINISTRADOR" },
    update: {},
    create: { name: "ADMINISTRADOR", description: "Administrador" }
  });

  return prisma.user.create({
    data: {
      firstName: `${PREFIX}${suffix}`,
      lastName: "Inventario",
      email: `${PREFIX}${suffix.toLowerCase()}@parkplaza.test`,
      documentNumber: `${PREFIX}${suffix}`,
      username: `${PREFIX}${suffix}`,
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

async function productStock(id) {
  const product = await prisma.product.findUnique({ where: { id } });
  return dec(product.stock);
}

async function lotQty(id) {
  const lot = await prisma.inventoryLot.findUnique({ where: { id } });
  return dec(lot.currentQty);
}

async function movementCount(productId, referencePart = "") {
  return prisma.inventoryMovement.count({
    where: {
      productId,
      reference: referencePart ? { contains: referencePart } : undefined
    }
  });
}

async function assertStockMatchesLots(productId, name) {
  const product = await prisma.product.findUnique({ where: { id: productId }, include: { inventoryLots: true } });
  const lotsSum = product.inventoryLots.reduce((sum, lot) => sum.plus(lot.currentQty), dec(0));
  await assert(dec(product.stock).equals(lotsSum), name, `stock=${dec(product.stock).toFixed(4)} lotes=${lotsSum.toFixed(4)}`);
}

async function controlledPhysicalStock(productId) {
  const [product, pending] = await Promise.all([
    prisma.product.findUnique({ where: { id: productId } }),
    prisma.inventoryInspection.findMany({ where: { productId, status: "PENDIENTE" }, select: { quantity: true } })
  ]);
  const pendingQty = pending.reduce((sum, item) => sum.plus(item.quantity), dec(0));
  return dec(product.stock).plus(pendingQty).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
}

async function run() {
  await cleanup();
  const category = await ensureCategory();
  const user = await ensureUser("CREATOR");
  const resolver = await ensureUser("RESOLVER");

  const productA = await createProduct(category, "A_PARTIAL", "10.0000");
  const lotA = await createLot(productA, "A_LOT", "10.0000");
  const retainedA = await retainForReview({
    productId: productA.id,
    inventoryLotId: lotA.id,
    quantity: "2.0000",
    reason: `${PREFIX}posible deterioro`,
    notes: `${PREFIX}observacion`,
    storageLocation: `${PREFIX}Congelador retenidos`,
    area: AREA
  }, user.id);
  await assert(eq(await productStock(productA.id), "8.0000"), "A/L. Retencion parcial descuenta Product.stock");
  await assert(eq(await lotQty(lotA.id), "8.0000"), "A/M. Retencion parcial descuenta InventoryLot.currentQty");
  await assert(retainedA.inspection.status === "PENDIENTE", "N. InventoryInspection PENDIENTE se crea");
  await assert(retainedA.inspection.createdById === user.id, "AH. createdById conservado");
  await assert(retainedA.inspection.area === AREA, "AJ. Area conservada");
  await assert(retainedA.inspection.reason === `${PREFIX}posible deterioro`, "AK. Reason conservado");
  await assert(retainedA.inspection.storageLocation === `${PREFIX}Congelador retenidos`, "AL. storageLocation conservado");
  await assert(retainedA.movement.inventoryLotId === lotA.id, "O. Movimiento RETENCION tiene inventoryLotId");
  await assert(retainedA.movement.type === "SALIDA" && retainedA.movement.origin === "OTRO", "O. Movimiento RETENCION es salida de stock disponible");
  await assert(eq(await controlledPhysicalStock(productA.id), "10.0000"), "AO. Stock fisico controlado = stock disponible + retenido pendiente");
  await assertStockMatchesLots(productA.id, "AN. Product.stock = SUM(lotes) tras retencion parcial");

  const productB = await createProduct(category, "B_TOTAL", "3.0000");
  const lotB = await createLot(productB, "B_LOT", "3.0000");
  await retainForReview({ productId: productB.id, inventoryLotId: lotB.id, quantity: "3.0000", reason: `${PREFIX}retencion total`, area: AREA }, user.id);
  await assert(eq(await productStock(productB.id), "0.0000") && eq(await lotQty(lotB.id), "0.0000"), "B. Retencion total deja stock disponible cero");
  await assert((await getAvailableLotsForProduct(productB.id)).length === 0, "P. FEFO no usa cantidad retenida");

  const productC = await createProduct(category, "C_INSUFFICIENT", "1.0000");
  const lotC = await createLot(productC, "C_LOT", "1.0000");
  await assertRejects(
    () => retainForReview({ productId: productC.id, inventoryLotId: lotC.id, quantity: "2.0000", reason: `${PREFIX}insuficiente`, area: AREA }, user.id),
    "C. Cantidad insuficiente rechazada",
    "Stock insuficiente"
  );

  const productD1 = await createProduct(category, "D_PRODUCT_A", "0.0000");
  const productD2 = await createProduct(category, "D_PRODUCT_B", "1.0000");
  const lotD = await createLot(productD2, "D_LOT_OTHER", "1.0000");
  await assertRejects(
    () => retainForReview({ productId: productD1.id, inventoryLotId: lotD.id, quantity: "0.5000", reason: `${PREFIX}lote incorrecto`, area: AREA }, user.id),
    "D. Lote incorrecto rechazado",
    "no pertenece"
  );

  await assertRejects(
    () => retainForReview({ productId: productD1.id, inventoryLotId: 999999999, quantity: "0.5000", reason: `${PREFIX}lote inexistente`, area: AREA }, user.id),
    "E. Lote inexistente rechazado",
    "Lote no encontrado"
  );

  const productF = await createProduct(category, "F_INACTIVE", "1.0000");
  const lotF = await createLot(productF, "F_LOT", "1.0000", { active: false });
  await assertRejects(
    () => retainForReview({ productId: productF.id, inventoryLotId: lotF.id, quantity: "0.5000", reason: `${PREFIX}lote inactivo`, area: AREA }, user.id),
    "F. Lote inactivo rechazado",
    "inactivo"
  );

  await assertRejects(() => retainForReview({ productId: productC.id, inventoryLotId: lotC.id, quantity: "0", reason: `${PREFIX}cero`, area: AREA }, user.id), "G. Cantidad cero rechazada", "mayor a cero");
  await assertRejects(() => retainForReview({ productId: productC.id, inventoryLotId: lotC.id, quantity: "-1", reason: `${PREFIX}negativo`, area: AREA }, user.id), "H. Cantidad negativa rechazada", "mayor a cero");
  await assertRejects(() => retainForReview({ productId: productC.id, inventoryLotId: lotC.id, quantity: "0.1000", area: AREA }, user.id), "I. Reason obligatorio", "motivo");
  await assertRejects(() => retainForReview({ productId: productC.id, quantity: "0.1000", reason: `${PREFIX}sin lote`, area: AREA }, user.id), "J. inventoryLotId obligatorio", "lote");

  const productK = await createProduct(category, "K_DECIMAL", "0.0050");
  const lotK = await createLot(productK, "K_LOT", "0.0050");
  const retainedK = await retainForReview({ productId: productK.id, inventoryLotId: lotK.id, quantity: "0.0050", reason: `${PREFIX}decimal`, area: AREA }, user.id);
  await assert(eq(retainedK.inspection.quantity, "0.0050") && eq(await productStock(productK.id), "0.0000") && eq(await lotQty(lotK.id), "0.0000"), "K. Decimal 0.0050");

  const productQ = await createProduct(category, "Q_APTO", "4.0000");
  const lotQ = await createLot(productQ, "Q_LOT", "4.0000");
  const retainedQ = await retainForReview({ productId: productQ.id, inventoryLotId: lotQ.id, quantity: "1.2500", reason: `${PREFIX}apto`, area: AREA }, user.id);
  const resolvedQ = await resolveInspection(retainedQ.inspection.id, { status: "APTO", resolutionNotes: `${PREFIX}apto confirmado` }, resolver.id);
  await assert(resolvedQ.inspection.status === "APTO", "Q. APTO devuelve cantidad exacta");
  await assert(eq(await productStock(productQ.id), "4.0000"), "R. APTO incrementa Product.stock");
  await assert(eq(await lotQty(lotQ.id), "4.0000"), "S. APTO incrementa InventoryLot.currentQty");
  await assert(resolvedQ.movement?.type === "ENTRADA" && resolvedQ.movement?.inventoryLotId === lotQ.id, "T. APTO crea movimiento ENTRADA");
  await assert(resolvedQ.inspection.resolvedById === resolver.id, "AI. resolvedById conservado");
  await assertRejects(() => resolveInspection(retainedQ.inspection.id, { status: "APTO" }, resolver.id), "Z. APTO no puede resolverse dos veces", "ya fue resuelto");
  await assertRejects(() => resolveInspection(retainedQ.inspection.id, { status: "NO_APTO" }, resolver.id), "AB. APTO no puede cambiar despues a NO_APTO", "ya fue resuelto");

  const productU = await createProduct(category, "U_NO_APTO", "5.0000");
  const lotU = await createLot(productU, "U_LOT", "5.0000");
  const retainedU = await retainForReview({ productId: productU.id, inventoryLotId: lotU.id, quantity: "2.0000", reason: `${PREFIX}no apto`, area: AREA }, user.id);
  const beforeNoAptoMovements = await movementCount(productU.id);
  const resolvedU = await resolveInspection(retainedU.inspection.id, { status: "NO_APTO", resolutionNotes: `${PREFIX}descartado` }, resolver.id);
  await assert(resolvedU.inspection.status === "NO_APTO", "U. NO_APTO no devuelve cantidad");
  await assert(eq(await productStock(productU.id), "3.0000"), "V. NO_APTO NO vuelve a descontar Product.stock");
  await assert(eq(await lotQty(lotU.id), "3.0000"), "W. NO_APTO NO vuelve a descontar InventoryLot.currentQty");
  await assert((await movementCount(productU.id)) === beforeNoAptoMovements, "X. NO_APTO no llama perdida fisica nuevamente");
  await assertRejects(() => resolveInspection(retainedU.inspection.id, { status: "NO_APTO" }, resolver.id), "AA. NO_APTO no puede resolverse dos veces", "ya fue resuelto");
  await assertRejects(() => resolveInspection(retainedU.inspection.id, { status: "APTO" }, resolver.id), "AC. NO_APTO no puede cambiar despues a APTO", "ya fue resuelto");
  await assertRejects(() => resolveInspection(retainedU.inspection.id, { status: "PENDIENTE" }, resolver.id), "Y. Solo PENDIENTE puede resolverse a resultado final", "APTO o NO_APTO");

  const productAD = await createProduct(category, "AD_CONCURRENCY_RETAIN", "5.0000");
  const lotAD = await createLot(productAD, "AD_LOT", "5.0000");
  const concurrentRetain = await Promise.allSettled([
    retainForReview({ productId: productAD.id, inventoryLotId: lotAD.id, quantity: "3.0000", reason: `${PREFIX}concurrencia A`, area: AREA }, user.id),
    retainForReview({ productId: productAD.id, inventoryLotId: lotAD.id, quantity: "3.0000", reason: `${PREFIX}concurrencia B`, area: AREA }, user.id)
  ]);
  await assert(concurrentRetain.filter((item) => item.status === "fulfilled").length === 1, "AD. Concurrencia al retener deja una operacion exitosa");
  await assert(concurrentRetain.filter((item) => item.status === "rejected").length === 1, "AP. Dos retenciones simultaneas no producen stock negativo");
  await assert(eq(await productStock(productAD.id), "2.0000") && eq(await lotQty(lotAD.id), "2.0000"), "AD/AP. Concurrencia al retener conserva stock disponible");

  const productAE = await createProduct(category, "AE_CONCURRENCY_RESOLVE", "4.0000");
  const lotAE = await createLot(productAE, "AE_LOT", "4.0000");
  const retainedAE = await retainForReview({ productId: productAE.id, inventoryLotId: lotAE.id, quantity: "1.0000", reason: `${PREFIX}resolver simultaneo`, area: AREA }, user.id);
  const concurrentResolve = await Promise.allSettled([
    resolveInspection(retainedAE.inspection.id, { status: "APTO", resolutionNotes: `${PREFIX}apto simultaneo` }, resolver.id),
    resolveInspection(retainedAE.inspection.id, { status: "NO_APTO", resolutionNotes: `${PREFIX}no apto simultaneo` }, resolver.id)
  ]);
  await assert(concurrentResolve.filter((item) => item.status === "fulfilled").length === 1, "AE. Concurrencia al resolver deja una resolucion exitosa");
  await assert(concurrentResolve.filter((item) => item.status === "rejected").length === 1, "AE. Concurrencia al resolver rechaza segunda resolucion");

  const productAF = await createProduct(category, "AF_ROLLBACK_RETAIN", "2.0000");
  const lotAF = await createLot(productAF, "AF_LOT", "2.0000");
  await assertRejects(
    () => retainForReview({ productId: productAF.id, inventoryLotId: lotAF.id, quantity: "1.0000", reason: `${PREFIX}rollback retener`, area: AREA }, 999999999),
    "AF. Rollback completo al retener"
  );
  await assert(eq(await productStock(productAF.id), "2.0000") && eq(await lotQty(lotAF.id), "2.0000") && (await prisma.inventoryInspection.count({ where: { productId: productAF.id } })) === 0, "AF. Rollback al retener no deja cambios");

  const productAG = await createProduct(category, "AG_ROLLBACK_RESOLVE", "2.0000");
  const lotAG = await createLot(productAG, "AG_LOT", "2.0000");
  const retainedAG = await retainForReview({ productId: productAG.id, inventoryLotId: lotAG.id, quantity: "1.0000", reason: `${PREFIX}rollback resolver`, area: AREA }, user.id);
  await assertRejects(() => resolveInspection(retainedAG.inspection.id, { status: "APTO" }, 999999999), "AG. Rollback completo al resolver");
  const afterAG = await prisma.inventoryInspection.findUnique({ where: { id: retainedAG.inspection.id } });
  await assert(afterAG.status === "PENDIENTE" && eq(await productStock(productAG.id), "1.0000") && eq(await lotQty(lotAG.id), "1.0000"), "AG. Rollback al resolver conserva pendiente y stock retenido");

  const history = await listInspections({ status: "NO_APTO", area: AREA });
  await assert(history.some((item) => item.id === retainedU.inspection.id), "AM. Historial conserva registro NO_APTO");

  for (const product of await prisma.product.findMany({ where: { name: { startsWith: PREFIX } } })) {
    await assertStockMatchesLots(product.id, `AN. Product.stock = SUM(InventoryLot.currentQty) para ${product.name}`);
  }

  await cleanup();
}

run()
  .then(async () => {
    console.log(`\n${results.length} verificaciones completadas correctamente.`);
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("\nFallo en test-inventory-inspections.js");
    console.error(error);
    await cleanup().catch((cleanupError) => console.error("Fallo limpiando datos de prueba", cleanupError));
    await prisma.$disconnect();
    process.exit(1);
  });
