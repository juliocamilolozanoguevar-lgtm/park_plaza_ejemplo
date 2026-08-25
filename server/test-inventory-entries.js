import { Prisma } from "@prisma/client";
import "./src/config/env.js";
import { prisma } from "./src/config/prisma.js";
import { createPurchase, receivePurchase } from "./src/services/admin.service.js";
import { registerInventoryEntry } from "./src/services/inventory-entry.service.js";
import { createProduct as createInventoryProduct } from "./src/services/inventory.service.js";
import { getAvailableLotsForProduct } from "./src/services/inventory-lot.service.js";

const PREFIX = "ZZTEST_F44A_";
const AREA = "RESTAURANTE";
const results = [];
let supplierSequence = 0;

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
        { supplierLotCode: { startsWith: PREFIX } },
        { product: { name: { startsWith: PREFIX } } },
        { supplier: { name: { startsWith: PREFIX } } }
      ]
    }
  });
  await prisma.purchaseItem.deleteMany({
    where: {
      OR: [
        { supplierLotCode: { startsWith: PREFIX } },
        { product: { name: { startsWith: PREFIX } } },
        { purchase: { supplier: { name: { startsWith: PREFIX } } } }
      ]
    }
  });
  await prisma.purchase.deleteMany({ where: { supplier: { name: { startsWith: PREFIX } } } });
  await prisma.supplier.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.product.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.category.deleteMany({ where: { name: `${PREFIX}CATEGORY` } });
}

async function ensureCategory() {
  return prisma.category.upsert({
    where: { name: `${PREFIX}CATEGORY` },
    update: {},
    create: { name: `${PREFIX}CATEGORY`, description: "Categoria aislada para pruebas Fase 4.4A" }
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

async function createSupplier(suffix) {
  supplierSequence += 1;
  return prisma.supplier.create({
    data: {
      ruc: `44${String(supplierSequence).padStart(9, "0")}`,
      name: `${PREFIX}${suffix}`,
      contact: "Control inventario",
      status: "ACTIVO"
    }
  });
}

async function createTestProduct(category, suffix, stock = "0", unit = "kg", cost = "10.00") {
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
      supplierId: options.supplierId || null,
      supplierLotCode: options.supplierLotCode || null,
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

async function createAndReceivePurchase({ supplier, product, quantity = "1.00", cost = "10.00", expiresAt = null, supplierLotCode = null, userId }) {
  const purchase = await createPurchase({
    supplierId: supplier.id,
    status: "PENDIENTE",
    items: [{
      productId: product.id,
      quantity,
      cost,
      expiresAt,
      supplierLotCode
    }]
  }, userId);
  const received = await receivePurchase(purchase.id, userId);
  return {
    purchase,
    received,
    item: received.items[0],
    movement: await prisma.inventoryMovement.findFirst({
      where: { reference: `COMPRA:${purchase.id}:ITEM:${received.items[0].id}` },
      include: { inventoryLot: true, createdBy: true }
    })
  };
}

async function productStock(id) {
  const product = await prisma.product.findUnique({ where: { id } });
  return dec(product.stock);
}

async function lotById(id) {
  return prisma.inventoryLot.findUnique({ where: { id } });
}

async function lotsForProduct(productId) {
  return prisma.inventoryLot.findMany({ where: { productId }, orderBy: { id: "asc" } });
}

async function assertStockMatchesLots(productId, name) {
  const product = await prisma.product.findUnique({ where: { id: productId }, include: { inventoryLots: true } });
  const lotsSum = product.inventoryLots.reduce((sum, lot) => sum.plus(lot.currentQty), dec(0));
  await assert(dec(product.stock).equals(lotsSum), name, `stock=${dec(product.stock).toFixed(4)} lotes=${lotsSum.toFixed(4)}`);
}

async function assertOnlyOneSupplierLot(productId, supplierId, supplierLotCode, name) {
  const count = await prisma.inventoryLot.count({ where: { productId, supplierId, supplierLotCode } });
  await assert(count === 1, name, `lotes=${count}`);
}

async function run() {
  await cleanup();
  const category = await ensureCategory();
  const user = await ensureUser();
  const supplierA = await createSupplier("SUPPLIER_A");
  const supplierB = await createSupplier("SUPPLIER_B");
  const expiryA = dateFromToday(45);
  const expiryB = dateFromToday(60);

  const productA = await createTestProduct(category, "A_PURCHASE_NEW", "0", "kg", "10.00");
  const first = await createAndReceivePurchase({ supplier: supplierA, product: productA, quantity: "5.00", cost: "10.00", expiresAt: expiryA, supplierLotCode: `${PREFIX}SUPLOT_A`, userId: user.id });
  const firstLot = first.movement.inventoryLot;
  await assert(Boolean(firstLot), "A. Compra crea lote nuevo");
  await assert(first.movement.inventoryLotId === firstLot.id, "B. Movimiento de compra guarda inventoryLotId");
  await assert(first.movement.createdById === user.id, "P. InventoryMovement guarda usuario");

  await createAndReceivePurchase({ supplier: supplierA, product: productA, quantity: "3.00", cost: "10.00", expiresAt: expiryA, supplierLotCode: `${PREFIX}SUPLOT_A`, userId: user.id });
  const reusedLot = await lotById(firstLot.id);
  await assertOnlyOneSupplierLot(productA.id, supplierA.id, `${PREFIX}SUPLOT_A`, "C. Compra reutiliza lote cuando coincide todo");
  await assert(eq(reusedLot.initialQty, "8.0000"), "D. Reutilizacion incrementa initialQty");
  await assert(eq(reusedLot.currentQty, "8.0000"), "E. Reutilizacion incrementa currentQty");

  const productSupplier = await createTestProduct(category, "F_SUPPLIER_DIFF", "0");
  await createAndReceivePurchase({ supplier: supplierA, product: productSupplier, quantity: "1.00", cost: "10.00", expiresAt: expiryA, supplierLotCode: `${PREFIX}SHARED`, userId: user.id });
  await createAndReceivePurchase({ supplier: supplierB, product: productSupplier, quantity: "1.00", cost: "10.00", expiresAt: expiryA, supplierLotCode: `${PREFIX}SHARED`, userId: user.id });
  await assert((await lotsForProduct(productSupplier.id)).length === 2, "F. Supplier distinto crea lote nuevo");

  const productG1 = await createTestProduct(category, "G_PRODUCT_A", "0");
  const productG2 = await createTestProduct(category, "G_PRODUCT_B", "0");
  await createAndReceivePurchase({ supplier: supplierA, product: productG1, quantity: "1.00", cost: "10.00", expiresAt: expiryA, supplierLotCode: `${PREFIX}PRODUCT_SCOPE`, userId: user.id });
  await createAndReceivePurchase({ supplier: supplierA, product: productG2, quantity: "1.00", cost: "10.00", expiresAt: expiryA, supplierLotCode: `${PREFIX}PRODUCT_SCOPE`, userId: user.id });
  await assert((await lotsForProduct(productG1.id)).length === 1 && (await lotsForProduct(productG2.id)).length === 1, "G. Product distinto nunca reutiliza lote");

  const productH = await createTestProduct(category, "H_CODE_DIFF", "0");
  await createAndReceivePurchase({ supplier: supplierA, product: productH, quantity: "1.00", cost: "10.00", expiresAt: expiryA, supplierLotCode: `${PREFIX}CODE_1`, userId: user.id });
  await createAndReceivePurchase({ supplier: supplierA, product: productH, quantity: "1.00", cost: "10.00", expiresAt: expiryA, supplierLotCode: `${PREFIX}CODE_2`, userId: user.id });
  await assert((await lotsForProduct(productH.id)).length === 2, "H. supplierLotCode distinto crea lote nuevo");

  const productI = await createTestProduct(category, "I_EXPIRY_DIFF", "0");
  await createAndReceivePurchase({ supplier: supplierA, product: productI, quantity: "1.00", cost: "10.00", expiresAt: expiryA, supplierLotCode: `${PREFIX}EXP`, userId: user.id });
  await createAndReceivePurchase({ supplier: supplierA, product: productI, quantity: "1.00", cost: "10.00", expiresAt: expiryB, supplierLotCode: `${PREFIX}EXP`, userId: user.id });
  await assert((await lotsForProduct(productI.id)).length === 2, "I. expiresAt distinto crea lote nuevo");

  const productJ = await createTestProduct(category, "J_COST_DIFF", "0");
  await createAndReceivePurchase({ supplier: supplierA, product: productJ, quantity: "1.00", cost: "10.00", expiresAt: expiryA, supplierLotCode: `${PREFIX}COST`, userId: user.id });
  await createAndReceivePurchase({ supplier: supplierA, product: productJ, quantity: "1.00", cost: "11.00", expiresAt: expiryA, supplierLotCode: `${PREFIX}COST`, userId: user.id });
  await assert((await lotsForProduct(productJ.id)).length === 2, "J. unitCost distinto crea lote nuevo");

  const productK = await createTestProduct(category, "K_EXPIRY_ONLY", "0");
  await createAndReceivePurchase({ supplier: supplierA, product: productK, quantity: "1.00", cost: "10.00", expiresAt: expiryA, supplierLotCode: `${PREFIX}K1`, userId: user.id });
  await createAndReceivePurchase({ supplier: supplierA, product: productK, quantity: "1.00", cost: "10.00", expiresAt: expiryA, supplierLotCode: `${PREFIX}K2`, userId: user.id });
  await assert((await lotsForProduct(productK.id)).length === 2, "K. Mismo vencimiento no fusiona lote distinto");

  const productL = await createTestProduct(category, "L_NO_SUPPLIER_LOT", "0");
  await createAndReceivePurchase({ supplier: supplierA, product: productL, quantity: "1.00", cost: "10.00", expiresAt: expiryA, userId: user.id });
  await createAndReceivePurchase({ supplier: supplierA, product: productL, quantity: "1.00", cost: "10.00", expiresAt: expiryA, userId: user.id });
  await assert((await lotsForProduct(productL.id)).length === 2, "L. Sin supplierLotCode crea lote interno nuevo");

  const productPurchaseDecimal = await createTestProduct(category, "PURCHASE_DECIMAL_00050", "0", "kg", "1.00");
  const decimalPurchase = await createAndReceivePurchase({
    supplier: supplierA,
    product: productPurchaseDecimal,
    quantity: "0.0050",
    cost: "1.00",
    expiresAt: expiryA,
    supplierLotCode: `${PREFIX}PURCHASE_DECIMAL`,
    userId: user.id
  });
  const decimalItem = await prisma.purchaseItem.findUnique({ where: { id: decimalPurchase.item.id } });
  const decimalLot = decimalPurchase.movement.inventoryLot;
  await assert(eq(decimalItem.quantity, "0.0050"), "Compra 0.0050 conserva PurchaseItem.quantity = 0.0050");
  await assert(eq(decimalLot.initialQty, "0.0050"), "Compra 0.0050 conserva InventoryLot.initialQty = 0.0050");
  await assert(eq(decimalLot.currentQty, "0.0050"), "Compra 0.0050 conserva InventoryLot.currentQty = 0.0050");
  await assert(eq(await productStock(productPurchaseDecimal.id), "0.0050"), "Compra 0.0050 conserva Product.stock = 0.0050");
  await assert(eq(decimalPurchase.movement.quantity, "0.0050"), "Compra 0.0050 conserva InventoryMovement.quantity = 0.0050");
  await assertStockMatchesLots(productPurchaseDecimal.id, "Compra 0.0050 mantiene Product.stock = SUM(lotes)");

  const productCancelled = await createTestProduct(category, "CANCELLED_PURCHASE", "0", "kg", "2.00");
  const cancelledPurchase = await createPurchase({
    supplierId: supplierA.id,
    status: "CANCELADA",
    items: [{
      productId: productCancelled.id,
      quantity: "2.0000",
      cost: "2.00",
      expiresAt: expiryA,
      supplierLotCode: `${PREFIX}CANCELLED_LOT`
    }]
  }, user.id);
  await assertRejects(
    () => receivePurchase(cancelledPurchase.id, user.id),
    "Compra CANCELADA no puede recibirse",
    "cancelada no puede recibirse"
  );
  const cancelledAfter = await prisma.purchase.findUnique({ where: { id: cancelledPurchase.id } });
  await assert(cancelledAfter.status === "CANCELADA", "Compra cancelada conserva status CANCELADA");
  await assert(eq(await productStock(productCancelled.id), "0.0000"), "Compra cancelada no modifica Product.stock");
  await assert((await prisma.inventoryLot.count({ where: { productId: productCancelled.id } })) === 0, "Compra cancelada no crea lote");
  await assert((await prisma.inventoryMovement.count({ where: { productId: productCancelled.id } })) === 0, "Compra cancelada no crea movimiento");

  const productM = await createTestProduct(category, "M_MANUAL_NEW", "0", "kg", "5.00");
  const manual = await registerInventoryEntry({
    productId: productM.id,
    quantity: "2.5000",
    cost: "5.50",
    expiresAt: expiryA,
    supplierLotCode: `${PREFIX}MANUAL`,
    reason: `${PREFIX}entrada manual`,
    reference: `${PREFIX}M_MANUAL_NEW`
  }, user.id);
  await assert(Boolean(manual.inventoryLot?.id), "M. Entrada manual crea lote nuevo");
  await assert(manual.inventoryLot.code.startsWith("ENT-"), "J. Entrada manual crea lote interno con codigo seguro");
  await assert(eq(manual.inventoryLot.currentQty, "2.5000"), "R. InventoryLot.currentQty aumenta correctamente");
  await assert(eq(manual.inventoryLot.initialQty, "2.5000"), "S. initialQty correcto");
  await assert(eq(manual.inventoryLot.unitCost, "5.50"), "T. unitCost correcto");
  await assert(new Date(manual.inventoryLot.expiresAt).getTime() === expiryA.getTime(), "U. expiresAt correcto");
  await assert(Boolean(manual.inventoryLot.receivedAt), "V. receivedAt correcto");

  const productN = await createTestProduct(category, "N_EXPLICIT_LOT", "4.0000", "kg", "6.00");
  const lotN = await createLot(productN, "N_LOT", "4.0000", { unitCost: "6.00", expiresAt: expiryA, supplierId: supplierA.id, supplierLotCode: `${PREFIX}NLOT` });
  const explicit = await registerInventoryEntry({
    productId: productN.id,
    inventoryLotId: lotN.id,
    quantity: "1.2500",
    cost: "6.00",
    expiresAt: expiryA,
    supplierId: supplierA.id,
    supplierLotCode: `${PREFIX}NLOT`,
    reason: `${PREFIX}entrada explicita`,
    reference: `${PREFIX}N_EXPLICIT`
  }, user.id);
  await assert(explicit.inventoryLot.id === lotN.id, "N. Entrada manual aumenta lote explicito valido");
  await assert(eq(await productStock(productN.id), "5.2500"), "Q. Product.stock aumenta correctamente");

  await assertRejects(
    () => registerInventoryEntry({ productId: productM.id, quantity: "1.0000", cost: "5.50", reference: `${PREFIX}O_REASON` }, user.id),
    "O. Reason obligatorio",
    "motivo"
  );

  const productW = await createTestProduct(category, "W_DECIMAL_SMALL", "0", "kg", "1.00");
  const small = await registerInventoryEntry({
    productId: productW.id,
    quantity: "0.0050",
    cost: "1.00",
    reason: `${PREFIX}decimal pequeno`,
    reference: `${PREFIX}W_DECIMAL`
  }, user.id);
  await assert(eq(small.inventoryLot.currentQty, "0.0050") && eq(small.movement.quantity, "0.0050"), "W. Decimal 0.0050");

  const productX = await createTestProduct(category, "X_ROLLBACK", "5.0000", "kg", "7.00");
  const lotX = await createLot(productX, "X_LOT", "5.0000", { unitCost: "7.00" });
  await assertRejects(
    () => registerInventoryEntry({ productId: productX.id, inventoryLotId: lotX.id, quantity: "1.0000", cost: "7.00", reason: `${PREFIX}rollback`, reference: `${PREFIX}X_ROLLBACK` }, 999999999),
    "X. Rollback completo"
  );
  await assert(eq(await productStock(productX.id), "5.0000") && eq((await lotById(lotX.id)).currentQty, "5.0000"), "X. Rollback conserva Product.stock e InventoryLot");

  const productY = await createTestProduct(category, "Y_CONCURRENCY", "0", "kg", "3.00");
  const concurrentA = await createPurchase({ supplierId: supplierA.id, status: "PENDIENTE", items: [{ productId: productY.id, quantity: "2.00", cost: "3.00", expiresAt: expiryA, supplierLotCode: `${PREFIX}CONCURRENT` }] }, user.id);
  const concurrentB = await createPurchase({ supplierId: supplierA.id, status: "PENDIENTE", items: [{ productId: productY.id, quantity: "4.00", cost: "3.00", expiresAt: expiryA, supplierLotCode: `${PREFIX}CONCURRENT` }] }, user.id);
  const concurrent = await Promise.allSettled([receivePurchase(concurrentA.id, user.id), receivePurchase(concurrentB.id, user.id)]);
  await assert(concurrent.every((item) => item.status === "fulfilled"), "Y. Concurrencia en recepcion de compras");
  await assertOnlyOneSupplierLot(productY.id, supplierA.id, `${PREFIX}CONCURRENT`, "Y. Concurrencia no duplica lote proveedor");
  await assert(eq(await productStock(productY.id), "6.0000"), "Y. Concurrencia mantiene stock acumulado");

  for (const product of await prisma.product.findMany({ where: { name: { startsWith: PREFIX } } })) {
    await assertStockMatchesLots(product.id, `Z. Product.stock = SUM(lotes) para ${product.name}`);
  }

  const productAA = await createTestProduct(category, "AA_FEFO", "3.0000", "kg", "2.00");
  const late = await createLot(productAA, "AA_LATE", "1.0000", { expiresAt: dateFromToday(90), unitCost: "2.00" });
  const early = await createLot(productAA, "AA_EARLY", "1.0000", { expiresAt: dateFromToday(10), unitCost: "2.00" });
  await createLot(productAA, "AA_NULL", "1.0000", { expiresAt: null, unitCost: "2.00" });
  const available = await getAvailableLotsForProduct(productAA.id);
  await assert(available[0].id === early.id && available[1].id === late.id, "AA. FEFO sigue ordenando correctamente lotes despues de recepcion");

  const createdProduct = await createInventoryProduct({
    name: `${PREFIX}AB_CREATE_PRODUCT`,
    categoryId: category.id,
    area: AREA,
    unit: "kg",
    stock: "99.0000",
    minStock: "0",
    cost: "1.00",
    price: "2.00",
    status: "ACTIVO"
  });
  await assert(eq(createdProduct.stock, "0.0000"), "AB. createProduct continua creando stock 0");

  await cleanup();
}

run()
  .then(async () => {
    console.log(`\n${results.length} verificaciones completadas correctamente.`);
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("\nFallo en test-inventory-entries.js");
    console.error(error);
    await cleanup().catch((cleanupError) => console.error("Fallo limpiando datos de prueba", cleanupError));
    await prisma.$disconnect();
    process.exit(1);
  });
