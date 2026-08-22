import bcrypt from "bcrypt";
import { Prisma, PrismaClient } from "@prisma/client";
import { registerInventoryExit } from "../src/services/inventory-exit.service.js";
import { registerInventoryLoss } from "../src/services/inventory-loss.service.js";
import { registerInventoryAdjustment } from "../src/services/inventory-adjustment.service.js";
import { retainForReview, resolveInspection } from "../src/services/inventory-inspection.service.js";
import { createProduction } from "../src/services/production.service.js";
import { createPurchase, receivePurchase } from "../src/services/admin.service.js";
import { updateOrderStatus } from "../src/services/order.service.js";
const prisma = new PrismaClient();
const PREFIX = "DEMO-";
const PASSWORD = "DemoParkPlaza123*";

const today = new Date();
today.setHours(0, 0, 0, 0);

function addDays(days, hour = 9, minute = 0) {
  const next = new Date(today);
  next.setDate(next.getDate() + days);
  next.setHours(hour, minute, 0, 0);
  return next;
}

function dec(value) {
  return new Prisma.Decimal(value || 0).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
}

function money(value) {
  return new Prisma.Decimal(value || 0).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

function pick(list, index) {
  return list[index % list.length];
}

async function deleteByChunks(model, where) {
  await model.deleteMany({ where });
}

async function clearDemoData() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SEED !== "true") {
    throw new Error("Seed demo bloqueado en production. Usa ALLOW_DEMO_SEED=true solo si realmente deseas cargar demo.");
  }

  const demoUsers = await prisma.user.findMany({ where: { email: { endsWith: "@demo.parkplaza.test" } }, select: { id: true } });
  const demoUserIds = demoUsers.map((user) => user.id);
  const demoProducts = await prisma.product.findMany({ where: { name: { startsWith: PREFIX } }, select: { id: true } });
  const demoProductIds = demoProducts.map((product) => product.id);
  const demoLots = await prisma.inventoryLot.findMany({ where: { code: { startsWith: "DEMO-LOTE-" } }, select: { id: true } });
  const demoLotIds = demoLots.map((lot) => lot.id);
  const demoSuppliers = await prisma.supplier.findMany({ where: { ruc: { startsWith: "20999" } }, select: { id: true } });
  const demoSupplierIds = demoSuppliers.map((supplier) => supplier.id);
  const demoClients = await prisma.client.findMany({ where: { documentNumber: { startsWith: "DEMO-DOC-" } }, select: { id: true } });
  const demoClientIds = demoClients.map((client) => client.id);
  const demoRooms = await prisma.room.findMany({ where: { number: { startsWith: "D" } }, select: { id: true } });
  const demoRoomIds = demoRooms.map((room) => room.id);

  const demoOrders = await prisma.order.findMany({ where: { code: { startsWith: PREFIX } }, select: { id: true } });
  const demoOrderIds = demoOrders.map((order) => order.id);
  const demoReservations = await prisma.reservation.findMany({ where: { code: { startsWith: "DEMO-RSV-" } }, select: { id: true } });
  const demoReservationIds = demoReservations.map((reservation) => reservation.id);
  const demoEvents = await prisma.event.findMany({ where: { name: { startsWith: PREFIX } }, select: { id: true } });
  const demoEventIds = demoEvents.map((event) => event.id);
  const demoCleaningTasks = await prisma.cleaningTask.findMany({ where: { roomId: { in: demoRoomIds } }, select: { id: true } });
  const demoCleaningTaskIds = demoCleaningTasks.map((task) => task.id);
  const demoReports = await prisma.operationalReport.findMany({ where: { code: { startsWith: PREFIX } }, select: { id: true } });
  const demoReportIds = demoReports.map((report) => report.id);

  await deleteByChunks(prisma.auditLog, { OR: [{ description: { startsWith: PREFIX } }, { detail: { startsWith: PREFIX } }, { userId: { in: demoUserIds } }] });
  await deleteByChunks(prisma.attendanceRecord, { userId: { in: demoUserIds } });
  await deleteByChunks(prisma.cashMovement, { OR: [{ concept: { startsWith: PREFIX } }, { createdById: { in: demoUserIds } }] });
  await deleteByChunks(prisma.invoice, { OR: [{ clientId: { in: demoClientIds } }, { payment: { reference: { startsWith: PREFIX } } }] });
  await deleteByChunks(prisma.payment, { OR: [{ reference: { startsWith: PREFIX } }, { clientId: { in: demoClientIds } }, { createdById: { in: demoUserIds } }] });
  await deleteByChunks(prisma.operationalReportEvidence, { reportId: { in: demoReportIds } });
  await deleteByChunks(prisma.operationalReport, { OR: [{ code: { startsWith: PREFIX } }, { reportedById: { in: demoUserIds } }, { productId: { in: demoProductIds } }] });
  await deleteByChunks(prisma.cleaningReport, { OR: [{ roomId: { in: demoRoomIds } }, { reportedById: { in: demoUserIds } }, { cleaningTaskId: { in: demoCleaningTaskIds } }] });
  await deleteByChunks(prisma.cleaningEvidence, { OR: [{ taskId: { in: demoCleaningTaskIds } }, { roomId: { in: demoRoomIds } }, { createdById: { in: demoUserIds } }] });
  await deleteByChunks(prisma.inventoryInspection, { OR: [{ productId: { in: demoProductIds } }, { inventoryLotId: { in: demoLotIds } }, { reference: { startsWith: PREFIX } }] });
  await deleteByChunks(prisma.inventoryMovement, { OR: [{ reference: { startsWith: PREFIX } }, { productId: { in: demoProductIds } }, { inventoryLotId: { in: demoLotIds } }] });
  await deleteByChunks(prisma.productionBatch, { OR: [{ code: { startsWith: PREFIX } }, { inputProductId: { in: demoProductIds } }, { outputProductId: { in: demoProductIds } }] });
  await deleteByChunks(prisma.orderStockLotAllocation, { inventoryLotId: { in: demoLotIds } });
  await deleteByChunks(prisma.orderStockReservationItem, { OR: [{ productId: { in: demoProductIds } }, { reservation: { orderId: { in: demoOrderIds } } }] });
  await deleteByChunks(prisma.orderStockReservation, { orderId: { in: demoOrderIds } });
  await deleteByChunks(prisma.consumption, { OR: [{ orderId: { in: demoOrderIds } }, { clientId: { in: demoClientIds } }, { concept: { startsWith: PREFIX } }] });
  await deleteByChunks(prisma.orderItem, { orderId: { in: demoOrderIds } });
  await deleteByChunks(prisma.order, { id: { in: demoOrderIds } });
  await deleteByChunks(prisma.recipeItem, { OR: [{ productId: { in: demoProductIds } }, { recipe: { name: { startsWith: PREFIX } } }] });
  await deleteByChunks(prisma.recipe, { name: { startsWith: PREFIX } });
  await deleteByChunks(prisma.eventContract, { eventId: { in: demoEventIds } });
  await deleteByChunks(prisma.poolReport, { OR: [{ clientId: { in: demoClientIds } }, { reportedById: { in: demoUserIds } }] });
  await deleteByChunks(prisma.poolEntry, { OR: [{ qrCode: { startsWith: PREFIX } }, { clientId: { in: demoClientIds } }, { eventId: { in: demoEventIds } }] });
  await deleteByChunks(prisma.event, { id: { in: demoEventIds } });
  await deleteByChunks(prisma.eventSpace, { name: { startsWith: PREFIX } });
  await deleteByChunks(prisma.vehicleEntry, { OR: [{ plate: { startsWith: PREFIX } }, { clientId: { in: demoClientIds } }] });
  await deleteByChunks(prisma.parkingSpace, { code: { startsWith: PREFIX } });
  await deleteByChunks(prisma.cleaningTask, { id: { in: demoCleaningTaskIds } });
  await deleteByChunks(prisma.stay, { OR: [{ reservationId: { in: demoReservationIds } }, { clientId: { in: demoClientIds } }, { roomId: { in: demoRoomIds } }] });
  await deleteByChunks(prisma.reservation, { id: { in: demoReservationIds } });
  await deleteByChunks(prisma.room, { id: { in: demoRoomIds } });
  await deleteByChunks(prisma.roomType, { name: { startsWith: PREFIX } });
  await deleteByChunks(prisma.purchaseItem, { OR: [{ productId: { in: demoProductIds } }, { purchase: { supplierId: { in: demoSupplierIds } } }] });
  await deleteByChunks(prisma.purchase, { OR: [{ supplierId: { in: demoSupplierIds } }, { createdById: { in: demoUserIds } }] });
  await deleteByChunks(prisma.inventoryLot, { OR: [{ id: { in: demoLotIds } }, { productId: { in: demoProductIds } }] });
  await deleteByChunks(prisma.supplyRequestItem, { request: { notes: { startsWith: PREFIX } } });
  await deleteByChunks(prisma.supplyRequest, { notes: { startsWith: PREFIX } });
  await deleteByChunks(prisma.product, { id: { in: demoProductIds } });
  await deleteByChunks(prisma.category, { name: { startsWith: PREFIX } });
  await deleteByChunks(prisma.supplier, { id: { in: demoSupplierIds } });
  await deleteByChunks(prisma.client, { id: { in: demoClientIds } });
  await deleteByChunks(prisma.user, { id: { in: demoUserIds } });
}

async function ensurePermissionsAndUsers() {
  const modules = [
    "DASHBOARD", "RECEPCION", "CLIENTES", "RESERVAS", "HABITACIONES", "CHECK_IN", "CHECK_OUT",
    "RESTAURANTE", "BARTENDER", "LIMPIEZA", "MANTENIMIENTO", "INVENTARIO", "COMPRAS", "PROVEEDORES",
    "PAGOS", "FACTURACION", "CAJA", "USUARIOS", "ROLES", "REPORTES", "AUDITORIA", "CONFIGURACION", "ASISTENCIA"
  ];
  const actions = ["VER", "CREAR", "EDITAR", "ELIMINAR"];
  const roles = {};

  for (const name of ["ADMINISTRADOR", "RECEPCIONISTA", "RESTAURANTE", "BARTENDER", "LIMPIEZA", "MANTENIMIENTO"]) {
    roles[name] = await prisma.role.upsert({
      where: { name },
      update: { description: name },
      create: { name, description: name }
    });
  }

  for (const module of modules) {
    for (const action of actions) {
      const permission = await prisma.permission.upsert({
        where: { module_action: { module, action } },
        update: {},
        create: { module, action }
      });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: roles.ADMINISTRADOR.id, permissionId: permission.id } },
        update: {},
        create: { roleId: roles.ADMINISTRADOR.id, permissionId: permission.id }
      });
    }
  }

  const roleModules = {
    RECEPCIONISTA: ["RECEPCION", "CLIENTES", "RESERVAS", "HABITACIONES", "CHECK_IN", "CHECK_OUT", "PAGOS", "FACTURACION"],
    RESTAURANTE: ["RESTAURANTE", "INVENTARIO", "REPORTES"],
    BARTENDER: ["BARTENDER", "INVENTARIO", "REPORTES"],
    LIMPIEZA: ["LIMPIEZA", "HABITACIONES", "REPORTES"],
    MANTENIMIENTO: ["MANTENIMIENTO", "INVENTARIO", "REPORTES", "ASISTENCIA"]
  };

  for (const [roleName, allowedModules] of Object.entries(roleModules)) {
    const permissions = await prisma.permission.findMany({ where: { module: { in: allowedModules } } });
    for (const permission of permissions) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: roles[roleName].id, permissionId: permission.id } },
        update: {},
        create: { roleId: roles[roleName].id, permissionId: permission.id }
      });
    }
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const userData = [
    ["ADMINISTRADOR", "Demo", "Administrador", "demo.admin@demo.parkplaza.test", "DEMO-ADM-001", "Administrador"],
    ["RECEPCIONISTA", "Demo", "Recepcion", "demo.recepcion@demo.parkplaza.test", "DEMO-REC-001", "Recepcionista"],
    ["RESTAURANTE", "Demo", "Restaurante", "demo.restaurante@demo.parkplaza.test", "DEMO-RES-001", "Jefe de restaurante"],
    ["BARTENDER", "Demo", "Bartender", "demo.bartender@demo.parkplaza.test", "DEMO-BAR-001", "Bartender"],
    ["LIMPIEZA", "Demo", "Limpieza", "demo.limpieza@demo.parkplaza.test", "DEMO-LIM-001", "Supervisora de limpieza"],
    ["MANTENIMIENTO", "Demo", "Mantenimiento", "demo.mantenimiento@demo.parkplaza.test", "DEMO-MAN-001", "Tecnico de mantenimiento"]
  ];
  const users = {};
  for (const [roleName, firstName, lastName, email, documentNumber, position] of userData) {
    users[roleName] = await prisma.user.upsert({
      where: { email },
      update: { firstName, lastName, documentNumber, position, passwordHash, roleId: roles[roleName].id, status: "ACTIVO" },
      create: {
        firstName,
        lastName,
        email,
        documentNumber,
        phone: "900000000",
        position,
        username: email.split("@")[0],
        hireDate: addDays(-60),
        passwordHash,
        roleId: roles[roleName].id,
        status: "ACTIVO"
      }
    });
  }
  return { roles, users };
}

async function createSuppliers() {
  const rows = [
    ["20999000001", "DEMO-Proveedor Carnes Oriente", "Rosa Hidalgo", "carnes.demo@parkplaza.test", "Carnes y aves"],
    ["20999000002", "DEMO-Verduras y Frutas Ucayali", "Victor Salas", "verduras.demo@parkplaza.test", "Verduras y frutas"],
    ["20999000003", "DEMO-Bebidas Amazonicas", "Carmen Ruiz", "bebidas.demo@parkplaza.test", "Bebidas"],
    ["20999000004", "DEMO-Limpieza Hotelera Selva", "Mauro Tello", "limpieza.demo@parkplaza.test", "Limpieza"],
    ["20999000005", "DEMO-Mantenimiento Integral Pucallpa", "Ivan Paredes", "mantenimiento.demo@parkplaza.test", "Mantenimiento"],
    ["20999000006", "DEMO-Abarrotes San Jose", "Elena Campos", "abarrotes.demo@parkplaza.test", "Abarrotes"]
  ];
  const suppliers = {};
  for (const [ruc, name, contact, email, address] of rows) {
    suppliers[name] = await prisma.supplier.upsert({
      where: { ruc },
      update: { name, contact, email, address, phone: `061-${ruc.slice(-6)}`, status: "ACTIVO" },
      create: { ruc, name, contact, email, address, phone: `061-${ruc.slice(-6)}`, status: "ACTIVO" }
    });
  }
  return suppliers;
}

async function createProducts() {
  const categories = {};
  for (const name of ["Abarrotes", "Carnes", "Verduras", "Bebidas", "Limpieza", "Mantenimiento", "Preparados"]) {
    categories[name] = await prisma.category.upsert({
      where: { name: `${PREFIX}${name}` },
      update: { description: `Categoria demo ${name}`, active: true },
      create: { name: `${PREFIX}${name}`, description: `Categoria demo ${name}`, active: true }
    });
  }

  const rows = [
    ["Carne de res", "RESTAURANTE", "kg", 3, 18, 45, "Carnes"],
    ["Pollo", "RESTAURANTE", "kg", 4, 9, 28, "Carnes"],
    ["Arroz", "RESTAURANTE", "kg", 8, 3, 12, "Abarrotes"],
    ["Papa", "RESTAURANTE", "kg", 6, 2, 8, "Verduras"],
    ["Cebolla", "RESTAURANTE", "kg", 3, 2.5, 6, "Verduras"],
    ["Tomate", "RESTAURANTE", "kg", 3, 3, 7, "Verduras"],
    ["Aceite", "RESTAURANTE", "L", 4, 7, 15, "Abarrotes"],
    ["Leche", "RESTAURANTE", "L", 5, 4, 10, "Abarrotes"],
    ["Huevos", "RESTAURANTE", "unidad", 24, 0.6, 1.2, "Abarrotes"],
    ["Filete marinado", "RESTAURANTE", "kg", 2, 22, 55, "Preparados"],
    ["Limon", "BARTENDER", "kg", 3, 3, 8, "Verduras"],
    ["Azucar", "BARTENDER", "kg", 4, 3.2, 7, "Abarrotes"],
    ["Jarabe simple", "BARTENDER", "L", 2, 6, 15, "Bebidas"],
    ["Hielo", "BARTENDER", "unidad", 12, 1.5, 3, "Bebidas"],
    ["Gaseosa", "BARTENDER", "unidad", 18, 2.5, 6, "Bebidas"],
    ["Agua mineral", "BARTENDER", "unidad", 24, 1.2, 3, "Bebidas"],
    ["Frutas mixtas", "BARTENDER", "kg", 3, 5, 14, "Verduras"],
    ["Detergente", "LIMPIEZA", "L", 4, 6, 12, "Limpieza"],
    ["Lejia", "LIMPIEZA", "L", 5, 4, 9, "Limpieza"],
    ["Desinfectante", "LIMPIEZA", "L", 5, 7, 16, "Limpieza"],
    ["Bolsas negras", "LIMPIEZA", "unidad", 20, 0.4, 1, "Limpieza"],
    ["Papel higienico", "LIMPIEZA", "unidad", 30, 0.8, 1.8, "Limpieza"],
    ["Jabon liquido", "LIMPIEZA", "L", 4, 8, 18, "Limpieza"],
    ["Pintura blanca", "MANTENIMIENTO", "L", 2, 15, 35, "Mantenimiento"],
    ["Foco LED", "MANTENIMIENTO", "unidad", 8, 6, 12, "Mantenimiento"],
    ["Tornillos", "MANTENIMIENTO", "unidad", 50, 0.1, 0.3, "Mantenimiento"],
    ["Cinta aislante", "MANTENIMIENTO", "unidad", 6, 2.5, 6, "Mantenimiento"],
    ["Repuesto de ducha", "MANTENIMIENTO", "unidad", 3, 18, 40, "Mantenimiento"]
  ];

  const products = {};
  for (const [name, area, unit, minStock, cost, price, category] of rows) {
    products[name] = await prisma.product.upsert({
      where: { name_categoryId: { name: `${PREFIX}${name}`, categoryId: categories[category].id } },
      update: { area, unit, minStock, cost, price, active: true, status: "ACTIVO" },
      create: {
        name: `${PREFIX}${name}`,
        categoryId: categories[category].id,
        area,
        unit,
        stock: 0,
        minStock,
        cost,
        price,
        active: true,
        status: "ACTIVO"
      }
    });
  }
  return { categories, products };
}

async function createLotWithMovement(product, index, qty, cost, expiresAt, supplier, user, note = "Stock inicial demo") {
  const lot = await prisma.inventoryLot.upsert({
    where: { code: `DEMO-LOTE-${String(index).padStart(3, "0")}` },
    update: {
      productId: product.id,
      supplierId: supplier?.id || null,
      supplierLotCode: `SUP-DEMO-${String(index).padStart(3, "0")}`,
      initialQty: dec(qty),
      currentQty: dec(qty),
      unitCost: money(cost),
      expiresAt,
      active: true
    },
    create: {
      productId: product.id,
      supplierId: supplier?.id || null,
      supplierLotCode: `SUP-DEMO-${String(index).padStart(3, "0")}`,
      code: `DEMO-LOTE-${String(index).padStart(3, "0")}`,
      initialQty: dec(qty),
      currentQty: dec(qty),
      unitCost: money(cost),
      expiresAt,
      active: true
    }
  });
  await prisma.product.update({ where: { id: product.id }, data: { stock: { increment: dec(qty) }, cost: money(cost) } });
  const updated = await prisma.product.findUnique({ where: { id: product.id } });
  await prisma.inventoryMovement.create({
    data: {
      productId: product.id,
      inventoryLotId: lot.id,
      type: "ENTRADA",
      origin: "ENTRADA_MANUAL",
      quantity: dec(qty),
      beforeQty: dec(updated.stock).minus(dec(qty)),
      afterQty: updated.stock,
      unitCost: money(cost),
      reason: note,
      reference: `${PREFIX}STOCK-INICIAL-${lot.code}`,
      createdById: user.id,
      createdAt: addDays(-20 + (index % 14), 9)
    }
  });
  return lot;
}

async function createInitialLots({ products, suppliers, users }) {
  const supplierList = Object.values(suppliers);
  let index = 1;
  const lotsByProduct = {};
  for (const product of Object.values(products)) {
    const unit = product.unit;
    const baseQty = unit === "unidad" ? 18 : unit === "kg" ? 8 : 10;
    const qtyA = product.name.includes("Foco") || product.name.includes("Cinta") ? 3 : baseQty;
    const qtyB = product.name.includes("Tornillos") ? 90 : unit === "unidad" ? 12 : 5;
    const lotA = await createLotWithMovement(product, index++, qtyA, Number(product.cost), addDays(2 + (index % 4), 0), pick(supplierList, index), users.ADMINISTRADOR);
    const lotB = await createLotWithMovement(product, index++, qtyB, Number(product.cost) * 1.08, index % 5 === 0 ? null : addDays(15 + (index % 20), 0), pick(supplierList, index + 1), users.ADMINISTRADOR);
    lotsByProduct[product.name.replace(PREFIX, "")] = [lotA, lotB];
  }
  return lotsByProduct;
}

async function createPurchasesDemo({ products, suppliers, users }) {
  const supplierValues = Object.values(suppliers);
  const productValues = Object.values(products);
  const statuses = ["BORRADOR", "PENDIENTE", "APROBADA", "RECIBIDA", "CANCELADA", "RECIBIDA", "PENDIENTE", "RECIBIDA", "APROBADA", "BORRADOR"];
  const purchases = [];
  for (let index = 0; index < statuses.length; index += 1) {
    const selected = [productValues[index], productValues[index + 6], productValues[index + 14]].filter(Boolean);
    const targetStatus = statuses[index];
    const purchase = await createPurchase({
      supplierId: supplierValues[index % supplierValues.length].id,
      status: targetStatus === "RECIBIDA" ? "APROBADA" : targetStatus,
      items: selected.map((product, itemIndex) => ({
        productId: product.id,
        quantity: itemIndex + 2,
        cost: Number(product.cost) + itemIndex,
        supplierLotCode: `DEMO-COMPRA-${index + 1}-ITEM-${itemIndex + 1}`,
        expiresAt: addDays(20 + index + itemIndex, 0)
      }))
    }, users.ADMINISTRADOR.id);
    await prisma.purchase.update({ where: { id: purchase.id }, data: { createdAt: addDays(-10 + index, 10) } });
    if (targetStatus === "RECIBIDA") purchases.push(await receivePurchase(purchase.id, users.ADMINISTRADOR.id));
    else purchases.push(purchase);
  }
  return purchases;
}

async function createRecipes(products) {
  const recipes = [
    ["Lomo saltado", "RESTAURANTE", [["Carne de res", 0.25, "kg"], ["Papa", 0.2, "kg"], ["Cebolla", 0.08, "kg"], ["Tomate", 0.08, "kg"], ["Aceite", 0.03, "L"]]],
    ["Arroz con pollo", "RESTAURANTE", [["Pollo", 0.25, "kg"], ["Arroz", 0.18, "kg"], ["Aceite", 0.02, "L"]]],
    ["Desayuno continental", "RESTAURANTE", [["Huevos", 2, "unidad"], ["Leche", 0.25, "L"]]],
    ["Limonada hotelera", "BARTENDER", [["Limon", 0.12, "kg"], ["Azucar", 0.06, "kg"], ["Agua mineral", 1, "unidad"], ["Hielo", 1, "unidad"]]]
  ];
  for (const [name, area, items] of recipes) {
    const existing = await prisma.recipe.findFirst({ where: { name: `${PREFIX}${name}`, area } });
    const data = items.map(([productName, quantity, unit]) => ({ productId: products[productName].id, quantity, unit }));
    if (existing) {
      await prisma.recipeItem.deleteMany({ where: { recipeId: existing.id } });
      await prisma.recipe.update({ where: { id: existing.id }, data: { active: true, items: { create: data } } });
    } else {
      await prisma.recipe.create({ data: { name: `${PREFIX}${name}`, area, active: true, items: { create: data } } });
    }
  }
}

async function createHotelBase() {
  const clients = [];
  for (let i = 1; i <= 16; i += 1) {
    clients.push(await prisma.client.upsert({
      where: { documentNumber: `DEMO-DOC-${String(i).padStart(3, "0")}` },
      update: {},
      create: {
        documentType: i % 5 === 0 ? "CE" : "DNI",
        documentNumber: `DEMO-DOC-${String(i).padStart(3, "0")}`,
        firstName: pick(["Juan", "Maria", "Carlos", "Ana", "Luis", "Rosa", "Sofia", "Paola"], i),
        lastName: pick(["Perez", "Lopez", "Ruiz", "Torres", "Gomez", "Diaz", "Ramirez", "Silva"], i),
        phone: `9${String(50000000 + i)}`,
        email: `cliente${i}@demo.parkplaza.test`,
        address: "Pucallpa, Peru",
        registeredAt: addDays(-30 + i, 9),
        status: i <= 8 ? "HOSPEDADO" : "ACTIVO"
      }
    }));
  }

  const roomTypes = [];
  for (const [name, price, capacity] of [["Simple", 120, 1], ["Doble", 160, 2], ["Matrimonial", 220, 2], ["Suite", 350, 4]]) {
    roomTypes.push(await prisma.roomType.upsert({
      where: { name: `${PREFIX}${name}` },
      update: { basePrice: price, capacity, active: true },
      create: { name: `${PREFIX}${name}`, description: `Tipo demo ${name}`, basePrice: price, capacity, active: true }
    }));
  }

  const rooms = [];
  for (let i = 1; i <= 12; i += 1) {
    const type = pick(roomTypes, i);
    rooms.push(await prisma.room.upsert({
      where: { number: `D${String(i).padStart(2, "0")}` },
      update: { status: pick(["OCUPADA", "LIBRE", "RESERVADA", "EN_LIMPIEZA", "MANTENIMIENTO"], i) },
      create: {
        number: `D${String(i).padStart(2, "0")}`,
        floor: Math.ceil(i / 4),
        typeId: type.id,
        price: type.basePrice,
        capacity: type.capacity,
        description: "Habitacion demo",
        status: pick(["OCUPADA", "LIBRE", "RESERVADA", "EN_LIMPIEZA", "MANTENIMIENTO"], i)
      }
    }));
  }

  const reservations = [];
  const stays = [];
  for (let i = 0; i < 10; i += 1) {
    const room = rooms[i];
    const status = pick(["CHECKED_IN", "CONFIRMADA", "PENDIENTE", "COMPLETADA"], i);
    const reservation = await prisma.reservation.upsert({
      where: { code: `DEMO-RSV-${String(i + 1).padStart(3, "0")}` },
      update: {},
      create: {
        code: `DEMO-RSV-${String(i + 1).padStart(3, "0")}`,
        clientId: clients[i].id,
        roomId: room.id,
        checkInDate: addDays(i < 4 ? -1 : i, 14),
        checkOutDate: addDays(i < 4 ? 2 : i + 2, 11),
        adults: 2,
        children: i % 3 === 0 ? 1 : 0,
        totalPrice: Number(room.price) * 2,
        advance: 100,
        balance: Number(room.price) * 2 - 100,
        status,
        origin: i % 2 === 0 ? "RECEPCION" : "WEB",
        notes: `${PREFIX}Reserva demo`
      }
    });
    reservations.push(reservation);
    if (status === "CHECKED_IN" || status === "COMPLETADA") {
      stays.push(await prisma.stay.upsert({
        where: { reservationId: reservation.id },
        update: {},
        create: {
          reservationId: reservation.id,
          clientId: clients[i].id,
          roomId: room.id,
          checkInAt: addDays(-1, 14),
          checkOutAt: status === "COMPLETADA" ? addDays(0, 10) : null,
          status: status === "COMPLETADA" ? "FINALIZADA" : "ACTIVA"
        }
      }));
    }
  }

  return { clients, rooms, reservations, stays };
}

async function createOrders({ products, stays, users }) {
  const activeStays = stays.filter((stay) => stay.status === "ACTIVA");
  const baseOrderSpecs = [
    ["RESTAURANTE", "Lomo saltado", 65],
    ["RESTAURANTE", "Arroz con pollo", 48],
    ["RESTAURANTE", "Desayuno continental", 32],
    ["BARTENDER", "Limonada hotelera", 18]
  ];
  const states = ["PENDIENTE", "EN_COCINA", "PREPARANDO", "LISTO", "ENTREGADO", "ENTREGADO", "ENTREGADO"];
  
  const orders = [];
  for (let i = 0; i < 30; i += 1) {
    const [area, itemName, price] = pick(baseOrderSpecs, i);
    const targetStatus = pick(states, i);
    const stay = pick(activeStays, i) || stays[0];
    
    // Distribucion de fechas desacoplada del status para garantizar ENTREGADOs hoy
    const daysOffset = -(i % 3); // Ensures overlap
    const backdate = addDays(daysOffset, 12 + (i % 8));
    const userId = area === "RESTAURANTE" ? users.RESTAURANTE.id : users.BARTENDER.id;

    let order = await prisma.order.upsert({
      where: { code: `${PREFIX}${area === "RESTAURANTE" ? "RES" : "BAR"}-${String(i + 1).padStart(3, "0")}` },
      update: { status: "PENDIENTE" },
      create: {
        code: `${PREFIX}${area === "RESTAURANTE" ? "RES" : "BAR"}-${String(i + 1).padStart(3, "0")}` ,
        area,
        clientId: stay.clientId,
        roomId: stay.roomId,
        stayId: stay.id,
        status: "PENDIENTE",
        total: price,
        notes: `${PREFIX}Pedido demo`,
        createdById: userId,
        createdAt: backdate
      }
    });

    await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        productId: area === "RESTAURANTE" ? products.Arroz.id : products["Agua mineral"].id,
        name: `${PREFIX}${itemName}`,
        category: area,
        price,
        quantity: 1
      }
    });
    
    // We must manually trigger the state transitions sequentially
    if (targetStatus !== "PENDIENTE") {
      order = await updateOrderStatus(order.id, "PREPARANDO", userId);
    }
    if (["LISTO", "ENTREGADO"].includes(targetStatus)) {
      order = await updateOrderStatus(order.id, "LISTO", userId);
    }
    if (targetStatus === "ENTREGADO") {
      order = await updateOrderStatus(order.id, "ENTREGADO", userId);
    }
    
    // Backdate everything created by order service so it looks nice in history
    await prisma.order.update({ where: { id: order.id }, data: { createdAt: backdate, updatedAt: backdate } });
    await prisma.inventoryMovement.updateMany({ where: { reference: { startsWith: `PEDIDO:${order.id}` } }, data: { createdAt: backdate } });
    await prisma.consumption.updateMany({ where: { orderId: order.id }, data: { createdAt: backdate } });
    
    orders.push(order);
  }
  return orders;
}

async function createSupplyRequests({ products, users }) {
  const reqs = [
    { area: "RESTAURANTE", userId: users.RESTAURANTE.id, items: [["Carne de res", 5], ["Aceite", 3], ["Cebolla", 2]], status: "PENDIENTE" },
    { area: "RESTAURANTE", userId: users.RESTAURANTE.id, items: [["Papa", 10], ["Tomate", 4]], status: "ENTREGADA" },
    { area: "BARTENDER", userId: users.BARTENDER.id, items: [["Limon", 4], ["Azucar", 5]], status: "PENDIENTE" },
    { area: "BARTENDER", userId: users.BARTENDER.id, items: [["Hielo", 12], ["Gaseosa", 24]], status: "ENTREGADA" }
  ];
  
  for (let i = 0; i < reqs.length; i++) {
    const r = reqs[i];
    const sr = await prisma.supplyRequest.create({
      data: {
        area: r.area,
        status: r.status,
        notes: `${PREFIX}Requisicion automatica`,
        createdAt: addDays(-i, 8)
      }
    });
    
    for (const [pName, qty] of r.items) {
      await prisma.supplyRequestItem.create({
        data: {
          requestId: sr.id,
          productId: products[pName].id,
          quantity: qty,
          unit: products[pName].unit
        }
      });
    }
  }
}

async function createOperationalData({ products, lotsByProduct, users, rooms }) {
  await createProduction({
    inputProductId: products["Carne de res"].id,
    outputProductId: products["Filete marinado"].id,
    inputQty: 5,
    outputQty: 4.15,
    notes: `${PREFIX}Produccion filete marinado`
  }, users.RESTAURANTE.id);

  await registerInventoryLoss({ productId: products.Tomate.id, quantity: 1.25, reason: `${PREFIX}Deterioro por maduracion`, reference: `${PREFIX}PERDIDA-TOMATE` }, users.RESTAURANTE.id);
  await registerInventoryLoss({ productId: products.Hielo.id, quantity: 2, reason: `${PREFIX}Derretimiento operativo`, reference: `${PREFIX}PERDIDA-HIELO` }, users.BARTENDER.id);
  await registerInventoryLoss({ productId: products.Lejia.id, quantity: 1, reason: `${PREFIX}Derrame controlado`, reference: `${PREFIX}PERDIDA-LEJIA` }, users.LIMPIEZA.id);
  await registerInventoryLoss({ productId: products["Foco LED"].id, quantity: 1, reason: `${PREFIX}Rotura durante instalacion`, reference: `${PREFIX}PERDIDA-FOCO` }, users.MANTENIMIENTO.id);

  await registerInventoryExit({ productId: products.Detergente.id, quantity: 1.5, inventoryLotId: lotsByProduct.Detergente[0].id, reason: `${PREFIX}Consumo limpieza habitaciones`, reference: `${PREFIX}SALIDA-LIMPIEZA`, origin: "SALIDA_MANUAL" }, users.LIMPIEZA.id);
  await registerInventoryExit({ productId: products.Tornillos.id, quantity: 10, reason: `${PREFIX}Uso mantenimiento preventivo`, reference: `${PREFIX}SALIDA-MANTENIMIENTO`, origin: "SALIDA_MANUAL" }, users.MANTENIMIENTO.id);

  const aceiteLot = await prisma.inventoryLot.findFirst({ where: { productId: products.Aceite.id, active: true }, orderBy: { expiresAt: "asc" } });
  await registerInventoryAdjustment({
    productId: products.Aceite.id,
    inventoryLotId: aceiteLot.id,
    expectedLotQty: aceiteLot.currentQty,
    countedQty: dec(aceiteLot.currentQty).minus(0.5),
    reason: `${PREFIX}Conteo fisico ajuste negativo`,
    reference: `${PREFIX}AJUSTE-NEGATIVO`
  }, users.ADMINISTRADOR.id);

  const pinturaLot = await prisma.inventoryLot.findFirst({ where: { productId: products["Pintura blanca"].id, active: true }, orderBy: { id: "asc" } });
  await registerInventoryAdjustment({
    productId: products["Pintura blanca"].id,
    inventoryLotId: pinturaLot.id,
    expectedLotQty: pinturaLot.currentQty,
    countedQty: dec(pinturaLot.currentQty).plus(0.75),
    reason: `${PREFIX}Reconteo fisico ajuste positivo`,
    reference: `${PREFIX}AJUSTE-POSITIVO`
  }, users.ADMINISTRADOR.id);

  const carneLot = await prisma.inventoryLot.findFirst({ where: { productId: products["Carne de res"].id, currentQty: { gt: 0 } }, orderBy: { id: "asc" } });
  const lecheLot = await prisma.inventoryLot.findFirst({ where: { productId: products.Leche.id, currentQty: { gt: 0 } }, orderBy: { id: "asc" } });
  const desinfectanteLot = await prisma.inventoryLot.findFirst({ where: { productId: products.Desinfectante.id, currentQty: { gt: 0 } }, orderBy: { id: "asc" } });
  const pending = await retainForReview({ productId: products["Carne de res"].id, inventoryLotId: carneLot.id, quantity: 1, reason: `${PREFIX}Posible deterioro`, notes: "Pendiente de evaluacion", storageLocation: "Camara fria - bandeja demo" }, users.RESTAURANTE.id);
  const apto = await retainForReview({ productId: products.Leche.id, inventoryLotId: lecheLot.id, quantity: 1, reason: `${PREFIX}Envase golpeado`, notes: "Revision por inocuidad", storageLocation: "Frio 2" }, users.RESTAURANTE.id);
  await resolveInspection(apto.inspection.id, { status: "APTO", resolutionNotes: `${PREFIX}Envase apto para uso` }, users.ADMINISTRADOR.id);
  const noApto = await retainForReview({ productId: products.Desinfectante.id, inventoryLotId: desinfectanteLot.id, quantity: 1, reason: `${PREFIX}Tapa filtrando`, notes: "No apto para operacion", storageLocation: "Almacen limpieza" }, users.LIMPIEZA.id);
  await resolveInspection(noApto.inspection.id, { status: "NO_APTO", resolutionNotes: `${PREFIX}Producto descartado, sin doble descuento` }, users.ADMINISTRADOR.id);

  const taskRooms = rooms.slice(0, 6);
  const tasks = [];
  for (let i = 0; i < taskRooms.length; i += 1) {
    tasks.push(await prisma.cleaningTask.create({
      data: {
        roomId: taskRooms[i].id,
        status: pick(["PENDIENTE", "EN_LIMPIEZA", "FINALIZADA"], i),
        priority: pick(["ALTA", "MEDIA", "BAJA"], i),
        assignedToId: users.LIMPIEZA.id,
        assignedTo: "Demo Limpieza",
        checkoutAt: addDays(-1, 10),
        startedAt: i % 3 !== 0 ? addDays(0, 8 + i) : null,
        finishedAt: i % 3 === 2 ? addDays(0, 12 + i) : null,
        finishedById: i % 3 === 2 ? users.LIMPIEZA.id : null,
        bathroom: i % 3 === 2,
        bed: i % 3 === 2,
        floor: i % 3 === 2,
        surfaces: i % 3 === 2,
        amenities: i % 3 === 2,
        finalCheck: i % 3 === 2
      }
    }));
  }

  const reportRows = [
    ["DEMO-MNT-001", "LIMPIEZA", "DANO_INFRAESTRUCTURA", "Ventana con vidrio roto", "ALTA", "ABIERTO", rooms[0].id, tasks[0].id],
    ["DEMO-MNT-002", "LIMPIEZA", "MANTENIMIENTO", "Ducha con baja presion", "MEDIA", "EN_REVISION", rooms[1].id, tasks[1].id],
    ["DEMO-MNT-003", "RESTAURANTE", "DANO_EQUIPO", "Horno principal no enciende", "ALTA", "RESUELTO", null, null],
    ["DEMO-OPS-001", "BARTENDER", "FALTA_INSUMO", "Hielo cerca del minimo", "MEDIA", "ABIERTO", null, null],
    ["DEMO-OPS-002", "BARTENDER", "DANO_EQUIPO", "Licuadora principal huele a quemado", "ALTA", "EN_REVISION", null, null],
    ["DEMO-OPS-003", "RESTAURANTE", "MANTENIMIENTO", "Refrigeradora emite ruido fuerte", "MEDIA", "ABIERTO", null, null]
  ];
  for (const [code, area, type, description, priority, status, roomId, cleaningTaskId] of reportRows) {
    const report = await prisma.operationalReport.create({
      data: {
        code,
        area,
        type,
        description: `${PREFIX}${description}`,
        priority,
        status,
        requiresMaintenance: type.includes("DANO") || type === "MANTENIMIENTO",
        reportedById: area === "BARTENDER" ? users.BARTENDER.id : users.LIMPIEZA.id,
        assignedToId: status !== "ABIERTO" ? users.MANTENIMIENTO.id : null,
        resolvedById: status === "RESUELTO" ? users.MANTENIMIENTO.id : null,
        roomId,
        cleaningTaskId,
        startedAt: status !== "ABIERTO" ? addDays(-1, 11) : null,
        resolvedAt: status === "RESUELTO" ? addDays(0, 15) : null,
        observations: `${PREFIX}Registro demo operativo`
      }
    });
    await prisma.operationalReportEvidence.create({
      data: { reportId: report.id, imageUrl: "/uploads/demo/damage-window-01.svg", fileName: "demo-evidencia.svg", mimeType: "image/svg+xml", size: 1024 }
    });
  }
  return { pendingInspectionId: pending.inspection.id };
}

async function createExtraBusinessData({ clients, reservations, stays, users }) {
  const eventSpace = await prisma.eventSpace.create({ data: { name: `${PREFIX}Salon Amazonas`, capacity: 80, basePrice: 1200, active: true } });
  const event = await prisma.event.create({
    data: {
      clientId: clients[0].id,
      spaceId: eventSpace.id,
      name: `${PREFIX}Cena empresarial`,
      type: "Corporativo",
      startsAt: addDays(7, 19),
      endsAt: addDays(7, 23),
      guests: 45,
      price: 1800,
      advance: 600,
      balance: 1200,
      status: "CONFIRMADO",
      notes: `${PREFIX}Evento demo`,
      createdById: users.RECEPCIONISTA.id
    }
  });

  const cash = await prisma.cashRegister.upsert({
    where: { id: 999001 },
    update: { status: "ABIERTA" },
    create: { id: 999001, openedById: users.ADMINISTRADOR.id, openingCash: 500, status: "ABIERTA", openedAt: addDays(0, 7) }
  });

  const payment = await prisma.payment.create({
    data: {
      clientId: clients[0].id,
      reservationId: reservations[0].id,
      stayId: stays[0]?.id || null,
      eventId: event.id,
      method: "EFECTIVO",
      reference: `${PREFIX}PAGO-001`,
      status: "REGISTRADO",
      area: "Recepcion",
      concept: `${PREFIX}Pago mixto reserva/evento`,
      amount: 450,
      createdById: users.RECEPCIONISTA.id,
      paidAt: addDays(0, 10)
    }
  });
  await prisma.cashMovement.create({
    data: { cashRegisterId: cash.id, paymentId: payment.id, type: "INGRESO", category: "Recepcion", method: "EFECTIVO", concept: `${PREFIX}Ingreso caja`, amount: 450, createdById: users.RECEPCIONISTA.id }
  });
  await prisma.invoice.create({
    data: { type: "BOLETA", series: "BDMO", number: 1, clientId: clients[0].id, paymentId: payment.id, subtotal: 381.36, tax: 68.64, total: 450, status: "EMITIDA" }
  });

  for (let i = 1; i <= 4; i += 1) {
    const space = await prisma.parkingSpace.create({ data: { code: `${PREFIX}PK-${i}`, status: i <= 2 ? "OCUPADO" : "LIBRE" } });
    if (i <= 2) {
      await prisma.vehicleEntry.create({ data: { spaceId: space.id, clientId: clients[i].id, plate: `${PREFIX}CAR-${i}`, brand: "Toyota", model: "Demo", color: "Gris", status: "ACTIVO" } });
    }
  }

  await prisma.attendanceRecord.createMany({
    data: Object.values(users).map((user, index) => ({
      userId: user.id,
      checkInAt: addDays(0, 7, 45 + index),
      checkOutAt: index % 2 === 0 ? addDays(0, 17, 5 + index) : null,
      durationMinutes: index % 2 === 0 ? 560 : null,
      status: index % 2 === 0 ? "FINALIZADA" : "PRESENTE"
    }))
  });

  await prisma.auditLog.createMany({
    data: [
      { userId: users.ADMINISTRADOR.id, action: "SEED", module: "DEMO", description: `${PREFIX}Carga demo`, detail: `${PREFIX}Datos administrativos cargados`, ip: "127.0.0.1" },
      { userId: users.RECEPCIONISTA.id, action: "CREAR", module: "RESERVAS", description: `${PREFIX}Reserva demo creada`, detail: `${PREFIX}Reserva DEMO-RSV-001`, ip: "127.0.0.1" }
    ]
  });
}

async function validateInvariants() {
  const products = await prisma.product.findMany({
    where: { name: { startsWith: PREFIX } },
    include: { inventoryLots: true, inventoryInspections: { where: { status: "PENDIENTE" } } }
  });
  const failures = [];
  for (const product of products) {
    const lotSum = product.inventoryLots.reduce((sum, lot) => sum.plus(lot.currentQty), new Prisma.Decimal(0));
    const stock = dec(product.stock);
    if (!stock.equals(lotSum)) failures.push(`${product.name}: stock ${stock.toFixed(4)} != lotes ${lotSum.toFixed(4)}`);
    if (stock.lt(0)) failures.push(`${product.name}: stock negativo`);
    for (const lot of product.inventoryLots) {
      if (dec(lot.currentQty).lt(0)) failures.push(`${product.name}/${lot.code}: lote negativo`);
    }
  }
  if (failures.length) throw new Error(`Invariantes demo invalidas:\n${failures.join("\n")}`);
  return products.length;
}

async function summary() {
  const counts = {
    users: await prisma.user.count({ where: { email: { endsWith: "@demo.parkplaza.test" } } }),
    suppliers: await prisma.supplier.count({ where: { ruc: { startsWith: "20999" } } }),
    products: await prisma.product.count({ where: { name: { startsWith: PREFIX } } }),
    lots: await prisma.inventoryLot.count({ where: { code: { startsWith: "DEMO-LOTE-" } } }),
    purchases: await prisma.purchase.count({ where: { supplier: { ruc: { startsWith: "20999" } } } }),
    movements: await prisma.inventoryMovement.count({ where: { OR: [{ reference: { startsWith: PREFIX } }, { product: { name: { startsWith: PREFIX } } }] } }),
    losses: await prisma.inventoryMovement.count({ where: { origin: { in: ["PERDIDA", "MERMA"] }, product: { name: { startsWith: PREFIX } } } }),
    inspections: await prisma.inventoryInspection.count({ where: { product: { name: { startsWith: PREFIX } } } }),
    orders: await prisma.order.count({ where: { code: { startsWith: PREFIX } } }),
    reservations: await prisma.reservation.count({ where: { code: { startsWith: "DEMO-RSV-" } } }),
    supplyRequests: await prisma.supplyRequest.count({ where: { notes: { startsWith: PREFIX } } }),
    productions: await prisma.productionBatch.count({ where: { OR: [{ code: { startsWith: PREFIX } }, { inputProduct: { name: { startsWith: PREFIX } } }] } }),
    cleaningTasks: await prisma.cleaningTask.count({ where: { room: { number: { startsWith: "D" } } } }),
    maintenanceReports: await prisma.operationalReport.count({ where: { code: { startsWith: "DEMO-MNT-" } } })
  };
  console.log(JSON.stringify({ status: "DEMO_SEED_OK", password: PASSWORD, counts }, null, 2));
  return counts;
}

async function main() {
  await clearDemoData();
  const { users } = await ensurePermissionsAndUsers();
  const suppliers = await createSuppliers();
  const { products } = await createProducts();
  const lotsByProduct = await createInitialLots({ products, suppliers, users });
  await createPurchasesDemo({ products, suppliers, users });
  await createRecipes(products);
  const hotel = await createHotelBase();
  await createOrders({ products, stays: hotel.stays, users });
  await createSupplyRequests({ products, users });
  await createOperationalData({ products, lotsByProduct, users, rooms: hotel.rooms });
  await createExtraBusinessData({ ...hotel, users });
  await validateInvariants();
  await summary();
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
