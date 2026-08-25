import { Prisma } from "@prisma/client";
import "./src/config/env.js";
import { prisma } from "./src/config/prisma.js";
import { createPurchase, receivePurchase } from "./src/services/admin.service.js";

const PREFIX = "ZZTEST_LOTS_";
const AREA = "RESTAURANTE";

const dec = (value) => new Prisma.Decimal(value || 0);
const qty = (value) => dec(value).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
const money = (value) => dec(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

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

async function cleanup() {
  await prisma.inventoryMovement.deleteMany({
    where: {
      OR: [
        { reference: { contains: PREFIX } },
        { inventoryLot: { code: { startsWith: PREFIX } } },
        { product: { name: { startsWith: PREFIX } } }
      ]
    }
  });
  await prisma.inventoryLot.deleteMany({ where: { OR: [{ code: { startsWith: PREFIX } }, { supplierLotCode: { startsWith: PREFIX } }, { product: { name: { startsWith: PREFIX } } }] } });
  await prisma.purchaseItem.deleteMany({ where: { OR: [{ supplierLotCode: { startsWith: PREFIX } }, { product: { name: { startsWith: PREFIX } } }, { purchase: { supplier: { name: { startsWith: PREFIX } } } }] } });
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
    create: { name: `${PREFIX}CATEGORY`, description: "Categoria aislada para prueba de lotes" }
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

async function createSupplier() {
  return prisma.supplier.create({
    data: { ruc: "77" + String(Date.now()).slice(-9), name: `${PREFIX}SUPPLIER`, contact: "Inventario", status: "ACTIVO" }
  });
}

async function createProduct(category, suffix, stock = "0", cost = "10.00") {
  return prisma.product.create({
    data: {
      name: `${PREFIX}${suffix}`,
      categoryId: category.id,
      area: AREA,
      unit: "kg",
      stock: qty(stock),
      minStock: qty("0"),
      cost: money(cost),
      price: money("20")
    }
  });
}

async function stockMatchesLots(productId) {
  const product = await prisma.product.findUnique({ where: { id: productId }, include: { inventoryLots: true } });
  const lotsSum = product.inventoryLots.reduce((sum, lot) => sum.plus(lot.currentQty), dec(0));
  return { product, lotsSum, ok: dec(product.stock).equals(lotsSum) };
}

async function run() {
  await cleanup();
  const category = await ensureCategory();
  const user = await ensureUser();
  const supplier = await createSupplier();
  const productA = await createProduct(category, "PRODUCT_A", "0");
  const productB = await createProduct(category, "PRODUCT_B", "0");

  const purchase = await createPurchase({
    supplierId: supplier.id,
    items: [
      { productId: productA.id, quantity: "10.0000", cost: "24.00", expiresAt: "2026-08-31T00:00:00.000Z", supplierLotCode: `${PREFIX}A1` },
      { productId: productB.id, quantity: "5.0000", cost: "15.50", supplierLotCode: `${PREFIX}B1` }
    ]
  }, user.id);
  await receivePurchase(purchase.id, user.id);

  const lotA = await prisma.inventoryLot.findFirst({ where: { purchaseItemId: purchase.items[0].id } });
  const lotB = await prisma.inventoryLot.findFirst({ where: { purchaseItemId: purchase.items[1].id } });
  await assert(Boolean(lotA && lotB), "Compra recibida crea lotes por item");
  await assert(dec(lotA.currentQty).equals("10.0000") && dec(lotB.currentQty).equals("5.0000"), "Lotes conservan cantidades recibidas");
  await assert(dec(lotA.unitCost).equals("24.00") && dec(lotB.unitCost).equals("15.50"), "Lotes conservan costo unitario");

  const movementA = await prisma.inventoryMovement.findFirst({ where: { productId: productA.id, reference: `COMPRA:${purchase.id}:ITEM:${purchase.items[0].id}` } });
  await assert(movementA?.inventoryLotId === lotA.id, "Movimiento de compra referencia lote");

  await assertRejects(() => receivePurchase(purchase.id, user.id), "Recepcion duplicada rechazada", "ya fue recibida");
  await assert((await prisma.inventoryLot.count({ where: { purchaseItemId: purchase.items[0].id } })) === 1, "Recepcion duplicada no crea lotes nuevos");

  const secondPurchase = await createPurchase({
    supplierId: supplier.id,
    items: [{ productId: productA.id, quantity: "2.0000", cost: "26.00", expiresAt: "2026-09-15T00:00:00.000Z", supplierLotCode: `${PREFIX}A2` }]
  }, user.id);
  await receivePurchase(secondPurchase.id, user.id);
  await assert((await prisma.inventoryLot.count({ where: { productId: productA.id } })) === 2, "Compra distinta crea lote independiente");

  const invariantA = await stockMatchesLots(productA.id);
  const invariantB = await stockMatchesLots(productB.id);
  await assert(invariantA.ok, "Product A mantiene Product.stock = SUM(lotes)", `stock=${dec(invariantA.product.stock).toFixed(4)} lotes=${invariantA.lotsSum.toFixed(4)}`);
  await assert(invariantB.ok, "Product B mantiene Product.stock = SUM(lotes)", `stock=${dec(invariantB.product.stock).toFixed(4)} lotes=${invariantB.lotsSum.toFixed(4)}`);

  console.log("\nTEST LOTS OK");
}

run()
  .catch((error) => {
    console.error("\nTEST LOTS FAIL");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
