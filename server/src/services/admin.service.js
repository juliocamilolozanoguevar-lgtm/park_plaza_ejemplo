import bcrypt from "bcrypt";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import { HttpError, notFound } from "../utils/httpError.js";
import { recordInventoryEntry, resolvePurchaseLot, roundMoney, roundQty, withInventoryEntryTransaction } from "./inventory-entry.service.js";

const money = (value) => Number(value || 0);

export function listParking() {
  return prisma.parkingSpace.findMany({
    include: {
      entries: {
        where: { status: "ACTIVO" },
        include: { client: { include: { stays: { where: { status: "ACTIVA" }, include: { room: true }, take: 1 } } } },
        orderBy: { entryAt: "desc" },
        take: 1
      }
    },
    orderBy: { code: "asc" }
  });
}

export async function registerVehicleEntry(data) {
  const spaceId = Number(data.spaceId);
  const space = await prisma.parkingSpace.findUnique({ where: { id: spaceId } });
  if (!space) throw notFound("Espacio de cochera no encontrado.");
  if (space.status === "OCUPADO") throw new HttpError(422, "El espacio ya esta ocupado.");

  return prisma.$transaction(async (tx) => {
    const entry = await tx.vehicleEntry.create({
      data: {
        spaceId,
        clientId: data.clientId ? Number(data.clientId) : null,
        plate: data.plate,
        brand: data.brand || null,
        model: data.model || null,
        color: data.color || null
      },
      include: { client: true, space: true }
    });
    await tx.parkingSpace.update({ where: { id: spaceId }, data: { status: "OCUPADO" } });
    return entry;
  });
}

export async function finishVehicleEntry(id) {
  const entry = await prisma.vehicleEntry.findUnique({ where: { id }, include: { space: true } });
  if (!entry) throw notFound("Entrada vehicular no encontrada.");
  return prisma.$transaction(async (tx) => {
    const finished = await tx.vehicleEntry.update({
      where: { id },
      data: { status: "FINALIZADO", exitAt: new Date() },
      include: { client: true, space: true }
    });
    await tx.parkingSpace.update({ where: { id: entry.spaceId }, data: { status: "LIBRE" } });
    return finished;
  });
}

export function listSuppliers() {
  return prisma.supplier.findMany({ include: { purchases: true }, orderBy: { name: "asc" } });
}

export function createSupplier(data) {
  return prisma.supplier.create({
    data: {
      ruc: data.ruc,
      name: data.name,
      contact: data.contact || null,
      phone: data.phone || null,
      email: data.email || null,
      address: data.address || null,
      status: data.status || "ACTIVO"
    }
  });
}

export async function updateSupplier(id, data) {
  await prisma.supplier.findUniqueOrThrow({ where: { id } });
  return prisma.supplier.update({
    where: { id },
    data: {
      ruc: data.ruc,
      name: data.name,
      contact: data.contact || null,
      phone: data.phone || null,
      email: data.email || null,
      address: data.address || null,
      status: data.status || "ACTIVO"
    }
  });
}

export function listPurchases() {
  return prisma.purchase.findMany({
    include: { supplier: true, items: { include: { product: true } } },
    orderBy: { createdAt: "desc" }
  });
}

export async function createPurchase(data, userId) {
  const items = data.items || [];
  if (!items.length) throw new HttpError(422, "La compra debe incluir al menos un producto.");
  const total = items.reduce((sum, item) => sum.plus(roundQty(item.quantity).times(roundMoney(item.cost))), new Prisma.Decimal(0));
  return prisma.purchase.create({
    data: {
      supplierId: Number(data.supplierId),
      status: data.status || "PENDIENTE",
      total,
      createdById: userId,
      items: {
        create: items.map((item) => ({
          productId: Number(item.productId),
          quantity: roundQty(item.quantity),
          cost: roundMoney(item.cost),
          expiresAt: item.expiresAt ? new Date(item.expiresAt) : null,
          supplierLotCode: item.supplierLotCode || null
        }))
      }
    },
    include: { supplier: true, items: { include: { product: true } } }
  });
}

export async function receivePurchase(id, userId) {
  return withInventoryEntryTransaction(async (tx) => {
    const purchase = await tx.purchase.findUnique({
      where: { id },
      include: { supplier: true, items: { include: { product: true } } }
    });
    if (!purchase) throw notFound("Compra no encontrada.");
    if (purchase.status === "RECIBIDA") throw new HttpError(422, "La compra ya fue recibida.");
    if (purchase.status === "CANCELADA") throw new HttpError(422, "La compra cancelada no puede recibirse.");

    for (const item of purchase.items) {
      if (!item.product) throw notFound("Producto no encontrado.");
      const lot = await resolvePurchaseLot(tx, purchase, item);
      await recordInventoryEntry(tx, {
        productId: item.productId,
        lotId: lot.id,
        quantity: item.quantity,
        unitCost: item.cost,
        type: "ENTRADA_COMPRA",
        origin: "COMPRA",
        reason: "Recepcion de compra",
        reference: `COMPRA:${purchase.id}:ITEM:${item.id}`,
        userId
      });
    }

    return tx.purchase.update({
      where: { id },
      data: { status: "RECIBIDA", receivedAt: new Date() },
      include: { supplier: true, items: { include: { product: true } } }
    });
  });
}

export function listPayments() {
  return prisma.payment.findMany({
    include: { client: true, reservation: { include: { room: true } }, stay: { include: { room: true } }, event: true, invoice: true },
    orderBy: { paidAt: "desc" },
    take: 200
  });
}

export async function createPayment(data, userId) {
  const amount = money(data.amount);
  if (amount <= 0) throw new HttpError(422, "El monto debe ser mayor a cero.");
  const openCash = await ensureOpenCashRegister(userId);
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        clientId: data.clientId ? Number(data.clientId) : null,
        reservationId: data.reservationId ? Number(data.reservationId) : null,
        stayId: data.stayId ? Number(data.stayId) : null,
        eventId: data.eventId ? Number(data.eventId) : null,
        method: data.method,
        reference: data.reference || null,
        area: data.area,
        concept: data.concept,
        amount,
        createdById: userId
      }
    });
    await tx.cashMovement.create({
      data: {
        cashRegisterId: openCash.id,
        paymentId: payment.id,
        type: "INGRESO",
        method: payment.method,
        concept: payment.concept,
        amount,
        createdById: userId
      }
    });
    return payment;
  });
}

export function listInvoices() {
  return prisma.invoice.findMany({ include: { client: true, payment: true }, orderBy: { issuedAt: "desc" }, take: 200 });
}

export async function createInvoice(data) {
  const subtotal = money(data.subtotal);
  const tax = data.tax !== undefined ? money(data.tax) : subtotal * 0.18;
  const total = data.total !== undefined ? money(data.total) : subtotal + tax;
  const last = await prisma.invoice.findFirst({ where: { series: data.series }, orderBy: { number: "desc" } });
  return prisma.invoice.create({
    data: {
      type: data.type,
      series: data.series || "B001",
      number: data.number ? Number(data.number) : (last?.number || 0) + 1,
      clientId: Number(data.clientId),
      paymentId: data.paymentId ? Number(data.paymentId) : null,
      subtotal,
      tax,
      total
    },
    include: { client: true, payment: true }
  });
}

export async function ensureOpenCashRegister(userId) {
  const current = await prisma.cashRegister.findFirst({ where: { status: "ABIERTA" }, orderBy: { openedAt: "desc" } });
  if (current) return current;
  return prisma.cashRegister.create({ data: { openedById: userId || 1, openingCash: 0, status: "ABIERTA" } });
}

export async function cashSummary() {
  const registers = await prisma.cashRegister.findMany({
    include: { movements: true },
    orderBy: { openedAt: "desc" },
    take: 20
  });
  const movements = await prisma.cashMovement.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  const income = movements.filter((item) => item.type === "INGRESO").reduce((sum, item) => sum + Number(item.amount), 0);
  const expenses = movements.filter((item) => item.type === "EGRESO").reduce((sum, item) => sum + Number(item.amount), 0);
  return { registers, movements, summary: { income, expenses, balance: income - expenses } };
}

export function createCashMovement(data, userId) {
  return prisma.$transaction(async (tx) => {
    const openCash = await ensureOpenCashRegister(userId);
    return tx.cashMovement.create({
      data: {
        cashRegisterId: openCash.id,
        type: data.type,
        category: data.category || null,
        method: data.method || null,
        concept: data.concept,
        amount: money(data.amount),
        createdById: userId
      }
    });
  });
}

export function listUsers() {
  return prisma.user.findMany({ include: { role: true }, orderBy: { firstName: "asc" } });
}

export function getUser(id) {
  return prisma.user.findUnique({ where: { id }, include: { role: true } });
}

export async function createUser(data) {
  const passwordHash = await bcrypt.hash(data.password || "ParkPlaza123*", 10);
  return prisma.user.create({
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      documentNumber: data.documentNumber || null,
      phone: data.phone || null,
      birthDate: data.birthDate ? new Date(data.birthDate) : null,
      photoUrl: data.photoUrl || null,
      position: data.position || null,
      hireDate: data.hireDate ? new Date(data.hireDate) : null,
      username: data.username || null,
      passwordHash,
      roleId: Number(data.roleId),
      status: data.status || "ACTIVO"
    },
    include: { role: true }
  });
}

export async function updateUser(id, data) {
  const current = await getUser(id);
  if (!current) throw notFound("Usuario no encontrado.");

  const nextRoleId = Number(data.roleId);
  const nextRole = await prisma.role.findUnique({ where: { id: nextRoleId } });
  if (!nextRole) throw notFound("Rol no encontrado.");

  if (current.role?.name === "ADMINISTRADOR" && (nextRole.name !== "ADMINISTRADOR" || data.status !== "ACTIVO")) {
    const activeAdmins = await prisma.user.count({ where: { status: "ACTIVO", role: { name: "ADMINISTRADOR" } } });
    if (activeAdmins <= 1) throw new HttpError(422, "No puedes quitar o desactivar el ultimo administrador activo.");
  }

  const update = {
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    documentNumber: data.documentNumber || null,
    phone: data.phone || null,
    birthDate: data.birthDate ? new Date(data.birthDate) : null,
    photoUrl: data.photoUrl || null,
    position: data.position || null,
    hireDate: data.hireDate ? new Date(data.hireDate) : null,
    username: data.username || null,
    roleId: Number(data.roleId),
    status: data.status || "ACTIVO"
  };
  if (data.password) update.passwordHash = await bcrypt.hash(data.password, 10);
  return prisma.user.update({ where: { id }, data: update, include: { role: true } });
}

export function listRoles() {
  return prisma.role.findMany({
    include: { permissions: { include: { permission: true } } },
    orderBy: { name: "asc" }
  });
}

export function listPermissions() {
  return prisma.permission.findMany({ orderBy: [{ module: "asc" }, { action: "asc" }] });
}

export async function updateRolePermissions(roleId, permissionIds) {
  return prisma.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({ where: { roleId } });
    if (permissionIds?.length) {
      await tx.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({ roleId, permissionId: Number(permissionId) })),
        skipDuplicates: true
      });
    }
    return tx.role.findUnique({ where: { id: roleId }, include: { permissions: { include: { permission: true } } } });
  });
}

export function listSettings() {
  return prisma.hotelSettings.findMany();
}

export function updateSettings(data) {
  return prisma.hotelSettings.upsert({
    where: { id: 1 },
    update: data,
    create: { id: 1, ...data }
  });
}

