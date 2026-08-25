import { Prisma } from "@prisma/client";
import "./src/config/env.js";
import { prisma } from "./src/config/prisma.js";
import { createPurchase, receivePurchase } from "./src/services/admin.service.js";
import { createProduct } from "./src/services/inventory.service.js";
import { registerInventoryEntry } from "./src/services/inventory-entry.service.js";
import { registerInventoryExit } from "./src/services/inventory-exit.service.js";
import { registerInventoryLoss } from "./src/services/inventory-loss.service.js";
import { registerInventoryAdjustment } from "./src/services/inventory-adjustment.service.js";
import { retainForReview, resolveInspection } from "./src/services/inventory-inspection.service.js";
import { createProduction } from "./src/services/production.service.js";
import { reserveOrderStock, consumeOrderReservation } from "./src/services/recipe.service.js";

const PREFIX = "ZZTEST_INV_FINAL_";
const AREA = "RESTAURANTE";

const dec = (value) => new Prisma.Decimal(value || 0);
const qty = (value) => dec(value).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
const money = (value) => dec(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

async function assert(condition, name, detail = "") {
  if (!condition) throw new Error(`${name}${detail ? `: ${detail}` : ""}`);
  console.log(`OK - ${name}${detail ? `: ${detail}` : ""}`);
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
  await prisma.inventoryInspection.deleteMany({ where: { OR: [{ reason: { contains: PREFIX } }, { product: { name: { startsWith: PREFIX } } }] } });
  await prisma.orderStockLotAllocation.deleteMany({ where: { OR: [{ inventoryLot: { product: { name: { startsWith: PREFIX } } } }, { reservationItem: { reservation: { order: { code: { startsWith: PREFIX } } } } }] } });
  await prisma.orderStockReservationItem.deleteMany({ where: { OR: [{ product: { name: { startsWith: PREFIX } } }, { reservation: { order: { code: { startsWith: PREFIX } } } }] } });
  await prisma.orderStockReservation.deleteMany({ where: { order: { code: { startsWith: PREFIX } } } });
  await prisma.recipeItem.deleteMany({ where: { OR: [{ product: { name: { startsWith: PREFIX } } }, { recipe: { name: { startsWith: PREFIX } } }] } });
  await prisma.recipe.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.productionBatch.deleteMany({ where: { OR: [{ notes: { contains: PREFIX } }, { inputProduct: { name: { startsWith: PREFIX } } }, { outputProduct: { name: { startsWith: PREFIX } } }] } });
  await prisma.inventoryLot.deleteMany({ where: { OR: [{ code: { startsWith: PREFIX } }, { product: { name: { startsWith: PREFIX } } }, { supplier: { name: { startsWith: PREFIX } } }] } });
  await prisma.purchaseItem.deleteMany({ where: { OR: [{ supplierLotCode: { startsWith: PREFIX } }, { product: { name: { startsWith: PREFIX } } }, { purchase: { supplier: { name: { startsWith: PREFIX } } } }] } });
  await prisma.purchase.deleteMany({ where: { supplier: { name: { startsWith: PREFIX } } } });
  await prisma.supplier.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.orderItem.deleteMany({ where: { order: { code: { startsWith: PREFIX } } } });
  await prisma.order.deleteMany({ where: { code: { startsWith: PREFIX } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.product.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.category.deleteMany({ where: { name: `${PREFIX}CATEGORY` } });
}

async function ensureCategory() {
  return prisma.category.upsert({
    where: { name: `${PREFIX}CATEGORY` },
    update: {},
    create: { name: `${PREFIX}CATEGORY`, description: "Categoria aislada para cierre final" }
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

async function makeProduct(category, suffix, unit = "kg", cost = "10.00") {
  return createProduct({
    name: `${PREFIX}${suffix}`,
    categoryId: category.id,
    area: AREA,
    unit,
    stock: 999,
    minStock: 0,
    cost,
    price: "20.00"
  });
}

async function makeSupplier() {
  return prisma.supplier.create({
    data: { ruc: "88" + String(Date.now()).slice(-9), name: `${PREFIX}SUPPLIER`, contact: "Inventario", status: "ACTIVO" }
  });
}

async function makeOrder(codeSuffix, itemName, quantity = 1, productId = null) {
  return prisma.order.create({
    data: {
      code: `${PREFIX}${codeSuffix}`,
      area: AREA,
      total: 20,
      items: { create: [{ productId, name: itemName, quantity, price: 20, category: "TEST" }] }
    },
    include: { items: true }
  });
}

async function makeRecipe(name, product, quantity, unit = product.unit) {
  return prisma.recipe.create({
    data: {
      name,
      area: AREA,
      items: { create: [{ productId: product.id, quantity: qty(quantity), unit }] }
    }
  });
}

async function productWithLots(productId) {
  return prisma.product.findUnique({ where: { id: productId }, include: { inventoryLots: true } });
}

async function assertStockMatchesLots(productId, name) {
  const product = await productWithLots(productId);
  const lotsSum = product.inventoryLots.reduce((sum, lot) => sum.plus(lot.currentQty), dec(0));
  await assert(dec(product.stock).equals(lotsSum), name, `stock=${dec(product.stock).toFixed(4)} lotes=${lotsSum.toFixed(4)}`);
}

async function pendingRetained(productId) {
  const aggregate = await prisma.inventoryInspection.aggregate({
    where: { productId, status: "PENDIENTE" },
    _sum: { quantity: true }
  });
  return dec(aggregate._sum.quantity || 0);
}

async function assertControlledStock(productId, expected, name) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  const controlled = dec(product.stock).plus(await pendingRetained(productId));
  await assert(controlled.equals(dec(expected)), name, `controlado=${controlled.toFixed(4)}`);
}

async function firstLot(productId) {
  return prisma.inventoryLot.findFirst({ where: { productId, currentQty: { gt: 0 }, active: true }, orderBy: { id: "asc" } });
}

async function receiveOnePurchase(product, supplier, user) {
  const purchase = await createPurchase({
    supplierId: supplier.id,
    status: "PENDIENTE",
    items: [{ productId: product.id, quantity: "5.0000", cost: "10.00", supplierLotCode: `${PREFIX}PURCHASE_LOT` }]
  }, user.id);
  await receivePurchase(purchase.id, user.id);
}

async function run() {
  await cleanup();
  const category = await ensureCategory();
  const user = await ensureUser();
  const supplier = await makeSupplier();

  const purchaseProduct = await makeProduct(category, "PURCHASE_PRODUCT");
  await assert(dec(purchaseProduct.stock).equals(0), "1. createProduct crea stock 0 aunque se envie stock inicial");
  await receiveOnePurchase(purchaseProduct, supplier, user);
  await assertStockMatchesLots(purchaseProduct.id, "2. Compra/recepcion mantiene invariante");

  await registerInventoryEntry({ productId: purchaseProduct.id, quantity: "2.0000", unitCost: "11.00", cost: "11.00", reason: `${PREFIX}entrada`, reference: `${PREFIX}ENTRADA` }, user.id);
  await assertStockMatchesLots(purchaseProduct.id, "3. Entrada manual mantiene invariante");

  const inputProduct = await makeProduct(category, "PRODUCTION_INPUT");
  const outputProduct = await makeProduct(category, "PRODUCTION_OUTPUT");
  await registerInventoryEntry({ productId: inputProduct.id, quantity: "5.0000", unitCost: "7.00", cost: "7.00", reason: `${PREFIX}insumo`, reference: `${PREFIX}INSUMO` }, user.id);
  await createProduction({ inputProductId: inputProduct.id, outputProductId: outputProduct.id, inputQty: "5.0000", outputQty: "4.1500", notes: `${PREFIX}produccion` }, user.id);
  await assertStockMatchesLots(inputProduct.id, "4. Produccion mantiene invariante en insumo");
  await assertStockMatchesLots(outputProduct.id, "4. Produccion mantiene invariante en producto obtenido");

  const orderProduct = await makeProduct(category, "ORDER_PRODUCT");
  await registerInventoryEntry({ productId: orderProduct.id, quantity: "3.0000", unitCost: "6.00", cost: "6.00", reason: `${PREFIX}pedido stock`, reference: `${PREFIX}ORDER_STOCK` }, user.id);
  const recipeName = `${PREFIX}ORDER_RECIPE`;
  await makeRecipe(recipeName, orderProduct, "1.0000");
  const order = await makeOrder("ORDER_001", recipeName, 1);
  await reserveOrderStock(order.id, user.id);
  await consumeOrderReservation(order.id, order.code, user.id);
  await assertStockMatchesLots(orderProduct.id, "5. Pedido/consumo mantiene invariante");

  const lossLot = await firstLot(purchaseProduct.id);
  await registerInventoryLoss({ productId: purchaseProduct.id, inventoryLotId: lossLot.id, quantity: "1.0000", reason: `${PREFIX}perdida`, reference: `${PREFIX}LOSS` }, user.id);
  await assertStockMatchesLots(purchaseProduct.id, "6. Perdida mantiene invariante");

  const holdProduct = await makeProduct(category, "HOLD_PRODUCT");
  await registerInventoryEntry({ productId: holdProduct.id, quantity: "6.0000", unitCost: "9.00", cost: "9.00", reason: `${PREFIX}hold stock`, reference: `${PREFIX}HOLD_STOCK` }, user.id);
  const holdLot = await firstLot(holdProduct.id);
  const hold = await retainForReview({ productId: holdProduct.id, inventoryLotId: holdLot.id, quantity: "2.0000", reason: `${PREFIX}retencion`, storageLocation: "Mesa de inspeccion" }, user.id);
  await assertStockMatchesLots(holdProduct.id, "7. Retencion mantiene disponible igual a suma de lotes");
  await assertControlledStock(holdProduct.id, "6.0000", "18. Stock fisico controlado suma disponible + pendiente");
  await resolveInspection(hold.inspection.id, { status: "APTO", resolutionNotes: `${PREFIX}apto` }, user.id);
  await assertStockMatchesLots(holdProduct.id, "8. APTO devuelve stock y mantiene invariante");
  await assertControlledStock(holdProduct.id, "6.0000", "18. APTO vuelve a disponible");

  const noApto = await retainForReview({ productId: holdProduct.id, inventoryLotId: holdLot.id, quantity: "1.0000", reason: `${PREFIX}retencion no apto` }, user.id);
  const beforeNoAptoMovements = await prisma.inventoryMovement.count({ where: { productId: holdProduct.id } });
  await resolveInspection(noApto.inspection.id, { status: "NO_APTO", resolutionNotes: `${PREFIX}no apto` }, user.id);
  const afterNoAptoMovements = await prisma.inventoryMovement.count({ where: { productId: holdProduct.id } });
  await assert(beforeNoAptoMovements === afterNoAptoMovements, "9. NO_APTO no crea segundo descuento");
  await assertStockMatchesLots(holdProduct.id, "9. NO_APTO mantiene invariante");

  const adjustLot = await firstLot(purchaseProduct.id);
  await registerInventoryAdjustment({ productId: purchaseProduct.id, inventoryLotId: adjustLot.id, expectedLotQty: adjustLot.currentQty, countedQty: dec(adjustLot.currentQty).minus("0.5000").toFixed(4), reason: `${PREFIX}ajuste`, reference: `${PREFIX}ADJUST` }, user.id);
  await assertStockMatchesLots(purchaseProduct.id, "10. Ajuste manual mantiene invariante");

  const exitExplicitLot = await firstLot(holdProduct.id);
  await registerInventoryExit({ productId: holdProduct.id, inventoryLotId: exitExplicitLot.id, quantity: "1.0000", reason: `${PREFIX}salida explicita`, reference: `${PREFIX}EXIT_EXPLICIT` }, user.id);
  await assertStockMatchesLots(holdProduct.id, "11. Salida explicita mantiene invariante");

  await registerInventoryExit({ productId: purchaseProduct.id, quantity: "1.0000", reason: `${PREFIX}salida fefo`, reference: `${PREFIX}EXIT_FEFO` }, user.id);
  await assertStockMatchesLots(purchaseProduct.id, "12. Salida FEFO mantiene invariante");

  console.log("\nFASE 4 FINAL - TEST INVENTORY INTEGRAL OK");
}

run()
  .catch((error) => {
    console.error("\nFASE 4 FINAL - TEST INVENTORY INTEGRAL FAIL");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
