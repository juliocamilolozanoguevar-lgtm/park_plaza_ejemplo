import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";
import {
  cancelServiceReservation,
  checkInServiceReservation,
  completeServiceReservation,
  createServiceReservation,
  getClientServiceReservationById,
  getClientServiceReservations,
  getPublicServices,
  getServiceAvailability,
  getServiceExtras,
  getServicePlans,
  payServiceReservation
} from "./src/services/service-reservation.service.js";

const prisma = new PrismaClient();
const PREFIX = "ZZSVC_";
const LOWER_PREFIX = PREFIX.toLowerCase();
const checks = [];

function ok(condition, message, details = "") {
  if (!condition) throw new Error(`${message}${details ? `: ${details}` : ""}`);
  checks.push(message);
  console.log(`OK - ${message}${details ? `: ${details}` : ""}`);
}

async function expectFail(fn, message, contains = "") {
  try {
    await fn();
  } catch (error) {
    if (contains && !String(error.message).includes(contains)) throw error;
    ok(true, message, error.message);
    return error;
  }
  throw new Error(`${message}: debio fallar`);
}

function limaDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const data = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${data.year}-${data.month}-${data.day}`;
}

function addDays(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return limaDateString(date);
}

function currentWideSlot(index = 0) {
  return {
    startTime: index === 0 ? "00:00" : `00:0${index}`,
    endTime: "23:59"
  };
}

async function cleanup() {
  const serviceReservations = await prisma.serviceReservation.findMany({
    where: {
      OR: [
        { code: { startsWith: PREFIX } },
        { client: { documentNumber: { startsWith: PREFIX } } },
        { planCode: { startsWith: PREFIX } }
      ]
    },
    select: { id: true }
  });
  const serviceReservationIds = serviceReservations.map((reservation) => reservation.id);
  await prisma.serviceReservationExtra.deleteMany({
    where: {
      OR: [
        { serviceReservationId: { in: serviceReservationIds } },
        { serviceExtra: { name: { startsWith: PREFIX } } }
      ]
    }
  });
  await prisma.payment.deleteMany({
    where: { OR: [{ reference: { startsWith: PREFIX } }, { serviceReservationId: { in: serviceReservationIds } }] }
  });
  await prisma.poolEntry.deleteMany({
    where: { OR: [{ qrCode: { startsWith: PREFIX } }, { serviceReservationId: { in: serviceReservationIds } }] }
  });
  await prisma.serviceReservation.deleteMany({ where: { id: { in: serviceReservationIds } } });
  await prisma.serviceExtra.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.servicePlan.deleteMany({ where: { code: { startsWith: PREFIX } } });
  await prisma.serviceSlot.deleteMany({
    where: {
      OR: [
        { serviceType: "PISCINA", startTime: "00:00", endTime: "23:59" },
        { serviceType: "MIRADOR", startTime: "00:01", endTime: "23:59" },
        { serviceType: "PISCINA", startTime: "00:02", endTime: "23:59" }
      ]
    }
  });
  await prisma.stay.deleteMany({ where: { reservation: { code: { startsWith: PREFIX } } } });
  await prisma.reservation.deleteMany({ where: { code: { startsWith: PREFIX } } });
  await prisma.room.deleteMany({ where: { number: { startsWith: PREFIX } } });
  await prisma.roomType.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.client.deleteMany({ where: { documentNumber: { startsWith: PREFIX } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: LOWER_PREFIX } } });
}

async function seedBase() {
  const role = await prisma.role.upsert({
    where: { name: "ADMINISTRADOR" },
    update: {},
    create: { name: "ADMINISTRADOR", description: "Administrador" }
  });
  const user = await prisma.user.create({
    data: {
      firstName: "Servicio",
      lastName: "Tester",
      email: `${PREFIX.toLowerCase()}admin@test.local`,
      documentNumber: `${PREFIX}USER`,
      passwordHash: "test",
      roleId: role.id
    }
  });
  const roomType = await prisma.roomType.create({
    data: { name: `${PREFIX}ROOM_TYPE`, basePrice: 100, capacity: 4, active: true }
  });
  const room = await prisma.room.create({
    data: { number: `${PREFIX}101`, floor: 1, typeId: roomType.id, price: 100, capacity: 4, status: "OCUPADA" }
  });

  const clients = [];
  const stays = [];
  for (let index = 1; index <= 4; index += 1) {
    const client = await prisma.client.create({
      data: {
        documentType: "DNI",
        documentNumber: `${PREFIX}DOC${index}`,
        firstName: `Cliente${index}`,
        lastName: "Servicio",
        status: "HOSPEDADO"
      }
    });
    const reservation = await prisma.reservation.create({
      data: {
        code: `${PREFIX}RSV${index}`,
        clientId: client.id,
        roomId: room.id,
        checkInDate: new Date(),
        checkOutDate: new Date(Date.now() + 86400000),
        adults: 2,
        totalPrice: 100,
        balance: 100,
        status: "CHECKED_IN"
      }
    });
    const stay = await prisma.stay.create({
      data: {
        reservationId: reservation.id,
        clientId: client.id,
        roomId: room.id,
        status: "ACTIVA",
        checkInAt: new Date()
      }
    });
    clients.push(client);
    stays.push(stay);
  }
  const externalClient = await prisma.client.create({
    data: {
      documentType: "DNI",
      documentNumber: `${PREFIX}EXT`,
      firstName: "ClienteExterno",
      lastName: "Servicio",
      status: "ACTIVO"
    }
  });

  const slotSpecs = [
    ["PISCINA", currentWideSlot(0), 80],
    ["MIRADOR", currentWideSlot(1), 80],
    ["PISCINA", currentWideSlot(2), 3]
  ];
  const slots = {};
  for (const [serviceType, times, capacity] of slotSpecs) {
    const slot = await prisma.serviceSlot.create({
      data: { serviceType, startTime: times.startTime, endTime: times.endTime, capacity, active: true }
    });
    slots[`${serviceType}_${capacity}`] = slot;
  }

  const planSpecs = [
    ["PISCINA", `${PREFIX}ADU`, "Adulto", 20, "ADULTO"],
    ["PISCINA", `${PREFIX}NIN`, "Nino", 10, "NINO"],
    ["PISCINA", `${PREFIX}FAM`, "Familiar", 55, "FAMILIAR"],
    ["MIRADOR", `${PREFIX}PER`, "Persona", 15, "PERSONA"],
    ["MIRADOR", `${PREFIX}FIJ`, "Privado", 100, "FIJO"]
  ];
  const plans = {};
  for (const [serviceType, code, name, price, pricingMode] of planSpecs) {
    const plan = await prisma.servicePlan.create({
      data: { serviceType, code, name: `${PREFIX}${name}`, price, pricingMode, active: true }
    });
    plans[code] = plan;
  }

  const poolExtra = await prisma.serviceExtra.create({ data: { serviceType: "PISCINA", name: `${PREFIX}Toalla`, price: 5, active: true } });
  const poolInactive = await prisma.serviceExtra.create({ data: { serviceType: "PISCINA", name: `${PREFIX}Inactivo`, price: 5, active: false } });
  const miradorExtra = await prisma.serviceExtra.create({ data: { serviceType: "MIRADOR", name: `${PREFIX}Vino`, price: 12, active: true } });

  return { user, clients, stays, externalClient, slots, plans, poolExtra, poolInactive, miradorExtra };
}

async function createFor(ctx, clientIndex, payload) {
  const client = ctx.clients[clientIndex];
  const stay = ctx.stays[clientIndex];
  return createServiceReservation(client.id, stay.id, stay.reservationId, payload);
}

async function main() {
  await cleanup();
  const ctx = await seedBase();
  const today = limaDateString();
  const tomorrow = addDays(1);

  ok((await getPublicServices()).length >= 2, "GET servicios");
  ok((await getServicePlans("PISCINA")).some((plan) => plan.code === `${PREFIX}ADU`), "GET planes Piscina");
  ok((await getServicePlans("MIRADOR")).some((plan) => plan.code === `${PREFIX}PER`), "GET planes Mirador");
  ok((await getServiceExtras("PISCINA")).some((extra) => extra.name === `${PREFIX}Toalla`), "GET extras Piscina");
  ok((await getServiceExtras("MIRADOR")).some((extra) => extra.name === `${PREFIX}Vino`), "GET extras Mirador");
  ok((await getServiceAvailability("PISCINA", { date: today })).length === 1, "Disponibilidad por date");
  ok((await getServiceAvailability("MIRADOR", { from: today })).length === 21, "Disponibilidad por from");

  const poolAdult = await createFor(ctx, 0, {
    serviceType: "PISCINA",
    date: today,
    slotId: ctx.slots.PISCINA_80.id,
    planId: ctx.plans[`${PREFIX}ADU`].id,
    adults: 2,
    children: 1,
    extras: [{ id: ctx.poolExtra.id, quantity: 2 }]
  });
  ok(poolAdult.totalAmount === 50, "Reserva Piscina y precio ADULTO");
  ok(poolAdult.qrCode === null, "QR pendiente no se expone");

  const poolChild = await createFor(ctx, 1, {
    serviceType: "PISCINA",
    date: today,
    slotId: ctx.slots.PISCINA_80.id,
    planId: ctx.plans[`${PREFIX}NIN`].id,
    adults: 0,
    children: 3
  });
  ok(poolChild.totalAmount === 30, "Precio NINO");

  const poolFamily = await createFor(ctx, 2, {
    serviceType: "PISCINA",
    date: today,
    slotId: ctx.slots.PISCINA_80.id,
    planId: ctx.plans[`${PREFIX}FAM`].id,
    adults: 2,
    children: 2
  });
  ok(poolFamily.totalAmount === 55, "Precio FAMILIAR");

  const miradorPerson = await createFor(ctx, 0, {
    serviceType: "MIRADOR",
    date: today,
    slotId: ctx.slots.MIRADOR_80.id,
    planId: ctx.plans[`${PREFIX}PER`].id,
    people: 3
  });
  ok(miradorPerson.totalAmount === 45, "Reserva Mirador y precio PERSONA");

  const miradorFixed = await createFor(ctx, 1, {
    serviceType: "MIRADOR",
    date: today,
    slotId: ctx.slots.MIRADOR_80.id,
    planId: ctx.plans[`${PREFIX}FIJ`].id,
    people: 4
  });
  ok(miradorFixed.totalAmount === 100, "Precio FIJO");

  await expectFail(() => createFor(ctx, 0, {
    serviceType: "MIRADOR",
    date: today,
    slotId: ctx.slots.MIRADOR_80.id,
    planId: ctx.plans[`${PREFIX}ADU`].id,
    people: 1
  }), "Plan cruzado falla");
  await expectFail(() => createFor(ctx, 0, {
    serviceType: "MIRADOR",
    date: today,
    slotId: ctx.slots.MIRADOR_80.id,
    planId: ctx.plans[`${PREFIX}PER`].id,
    people: 1,
    extras: [{ id: ctx.poolExtra.id, quantity: 1 }]
  }), "Extra cruzado falla");
  await expectFail(() => createFor(ctx, 0, {
    serviceType: "PISCINA",
    date: today,
    slotId: ctx.slots.PISCINA_80.id,
    planId: ctx.plans[`${PREFIX}ADU`].id,
    adults: 1,
    extras: [{ id: ctx.poolInactive.id, quantity: 1 }]
  }), "Extra inactive falla");
  await expectFail(() => createFor(ctx, 0, {
    serviceType: "PISCINA",
    date: today,
    slotId: ctx.slots.PISCINA_80.id,
    planId: ctx.plans[`${PREFIX}ADU`].id,
    adults: 1,
    extras: [{ id: ctx.poolExtra.id, quantity: 0 }]
  }), "Quantity <= 0 falla");
  await expectFail(() => createFor(ctx, 0, {
    serviceType: "PISCINA",
    date: addDays(-1),
    slotId: ctx.slots.PISCINA_80.id,
    planId: ctx.plans[`${PREFIX}ADU`].id,
    adults: 1
  }), "Fecha pasada falla");

  await createFor(ctx, 0, {
    serviceType: "PISCINA",
    date: tomorrow,
    slotId: ctx.slots.PISCINA_3.id,
    planId: ctx.plans[`${PREFIX}ADU`].id,
    adults: 2
  });
  await expectFail(() => createFor(ctx, 1, {
    serviceType: "PISCINA",
    date: tomorrow,
    slotId: ctx.slots.PISCINA_3.id,
    planId: ctx.plans[`${PREFIX}ADU`].id,
    adults: 2
  }), "Capacidad insuficiente falla");

  const raceDate = addDays(2);
  const race = await Promise.allSettled([
    createFor(ctx, 0, { serviceType: "PISCINA", date: raceDate, slotId: ctx.slots.PISCINA_3.id, planId: ctx.plans[`${PREFIX}ADU`].id, adults: 2 }),
    createFor(ctx, 1, { serviceType: "PISCINA", date: raceDate, slotId: ctx.slots.PISCINA_3.id, planId: ctx.plans[`${PREFIX}ADU`].id, adults: 2 })
  ]);
  ok(race.filter((item) => item.status === "fulfilled").length === 1, "Concurrencia no sobrevende");

  ok((await getClientServiceReservations(ctx.clients[0].id, ctx.stays[0].id)).length >= 1, "Cliente ve propias");
  await expectFail(() => getClientServiceReservationById(ctx.clients[1].id, ctx.stays[1].id, poolAdult.id), "Detalle ajeno falla");

  const ownCancel = await createFor(ctx, 3, {
    serviceType: "MIRADOR",
    date: addDays(3),
    slotId: ctx.slots.MIRADOR_80.id,
    planId: ctx.plans[`${PREFIX}PER`].id,
    people: 1
  });
  ok((await cancelServiceReservation(ctx.clients[3].id, ctx.stays[3].id, ownCancel.id)).status === "CANCELADA", "Cancelacion propia");
  await expectFail(() => cancelServiceReservation(ctx.clients[2].id, ctx.stays[2].id, poolAdult.id), "Cancelacion ajena falla");

  const partial = await payServiceReservation(ctx.clients[0].id, ctx.stays[0].id, poolAdult.id, { method: "YAPE", amount: 10, reference: `${PREFIX}PAY1` });
  ok(partial.status === "PENDIENTE" && partial.balance === 40, "Pago parcial mantiene PENDIENTE");
  const confirmed = await payServiceReservation(ctx.clients[0].id, ctx.stays[0].id, poolAdult.id, { method: "YAPE", amount: 40, reference: `${PREFIX}PAY2` });
  ok(confirmed.status === "CONFIRMADA" && confirmed.balance === 0 && confirmed.qrCode, "Pago total pasa CONFIRMADA");
  await expectFail(() => payServiceReservation(ctx.clients[0].id, ctx.stays[0].id, poolAdult.id, { method: "YAPE", amount: 1 }), "Sobrepago falla");
  await expectFail(() => checkInServiceReservation(poolChild.id, ctx.user, "PISCINA"), "QR pendiente no permite ingreso");

  const checkedPool = await checkInServiceReservation(poolAdult.id, ctx.user, "PISCINA");
  ok(checkedPool.status === "EN_USO", "Piscina confirmada hace check-in");
  const poolEntry = await prisma.poolEntry.findFirst({ where: { serviceReservationId: poolAdult.id } });
  ok(poolEntry?.type === "HUESPED", "Huesped genera PoolEntry HUESPED");
  await expectFail(() => checkInServiceReservation(poolAdult.id, ctx.user, "PISCINA"), "No doble check-in");
  const completedPool = await completeServiceReservation(poolAdult.id, "PISCINA");
  ok(completedPool.status === "FINALIZADA", "Complete Piscina");
  const finishedEntry = await prisma.poolEntry.findFirst({ where: { serviceReservationId: poolAdult.id } });
  ok(finishedEntry?.status === "FINALIZADO", "PoolEntry finaliza");
  await expectFail(() => completeServiceReservation(poolAdult.id, "PISCINA"), "No doble complete");
  await expectFail(() => cancelServiceReservation(ctx.clients[0].id, ctx.stays[0].id, poolAdult.id), "Cancelacion EN_USO/FINALIZADA falla");

  const externalPool = await createServiceReservation(ctx.externalClient.id, null, null, {
    serviceType: "PISCINA",
    date: today,
    slotId: ctx.slots.PISCINA_80.id,
    planId: ctx.plans[`${PREFIX}ADU`].id,
    adults: 1
  });
  await payServiceReservation(ctx.externalClient.id, null, externalPool.id, { method: "EFECTIVO", amount: 20, reference: `${PREFIX}PAY_EXT` });
  await checkInServiceReservation(externalPool.id, ctx.user, "PISCINA");
  const externalEntry = await prisma.poolEntry.findFirst({ where: { serviceReservationId: externalPool.id } });
  ok(externalEntry?.type === "CLIENTE_EXTERNO", "Externo genera PoolEntry CLIENTE_EXTERNO");
  await completeServiceReservation(externalPool.id, "PISCINA");

  await payServiceReservation(ctx.clients[0].id, ctx.stays[0].id, miradorPerson.id, { method: "EFECTIVO", amount: 45, reference: `${PREFIX}PAY3` });
  const checkedMirador = await checkInServiceReservation(miradorPerson.id, ctx.user, "MIRADOR");
  ok(checkedMirador.status === "EN_USO", "Check-in Mirador");
  ok(await prisma.poolEntry.count({ where: { serviceReservationId: miradorPerson.id } }) === 0, "Mirador NO crea PoolEntry");
  const completedMirador = await completeServiceReservation(miradorPerson.id, "MIRADOR");
  ok(completedMirador.status === "FINALIZADA", "Complete Mirador");

  const serviceSource = await readFile(new URL("./src/services/service-reservation.service.js", import.meta.url), "utf8");
  const createdTxStart = serviceSource.indexOf("created = await withSerializableRetry");
  const createdTxEnd = serviceSource.indexOf("\n    });", createdTxStart);
  const createdEmitIndex = serviceSource.indexOf("emitServiceReservation(\"service-reservation:created\"", createdTxStart);
  ok(createdTxStart >= 0 && createdTxEnd > createdTxStart && createdEmitIndex > createdTxEnd, "Socket created ocurre despues del commit");
  ok(!serviceSource.slice(createdTxStart, createdTxEnd).includes("emitServiceReservation("), "Rollback no emite dentro de transaction");

  console.log(`\nSERVICE RESERVATIONS API TEST OK - ${checks.length} verificaciones`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await cleanup().catch(() => {});
    await prisma.$disconnect();
  });
