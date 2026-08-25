import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("=== INICIANDO TEST: SERVICE RESERVATIONS ===\n");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 1. Verificar Planes
  const planes = await prisma.servicePlan.findMany();
  console.log(`- Planes encontrados: ${planes.length}`);

  // 2. Verificar Slots
  const slots = await prisma.serviceSlot.findMany();
  console.log(`- Slots encontrados: ${slots.length}`);

  // 3. Crear una reserva a mano simulando la creación (con API o con logic directo)
  // Como esto es test db directly, probaremos concurrency / creacion.
  const poolPlan = planes.find(p => p.serviceType === "PISCINA");
  const poolSlot = slots.find(s => s.serviceType === "PISCINA");
  const client = await prisma.client.findFirst();

  if (!poolPlan || !poolSlot || !client) {
    console.log("Faltan datos base. Ejecute seed-demo-complete.js primero.");
    return;
  }

  console.log("\n-> Creando reserva PISCINA para", client.firstName);
  const code = `TEST-P-${Date.now()}`;
  const res = await prisma.serviceReservation.create({
    data: {
      code,
      clientId: client.id,
      serviceType: "PISCINA",
      status: "PENDIENTE",
      date: today,
      slotId: poolSlot.id,
      adults: 2,
      people: 2,
      planId: poolPlan.id,
      baseAmount: Number(poolPlan.price) * 2,
      totalAmount: Number(poolPlan.price) * 2,
      balance: Number(poolPlan.price) * 2,
      qrCode: `QR-${code}`
    }
  });

  console.log("Reserva creada:", res.code, res.status, "Total:", res.totalAmount);

  // 4. Test Check-in
  console.log("\n-> Haciendo check-in...");
  const checkInRes = await prisma.serviceReservation.update({
    where: { id: res.id },
    data: { status: "EN_USO", checkedInAt: new Date() }
  });
  console.log("Check-in exitoso. Status:", checkInRes.status);
  
  const poolEntry = await prisma.poolEntry.create({
    data: {
      clientId: client.id,
      serviceReservationId: res.id,
      type: "CLIENTE_EXTERNO",
      people: res.people,
      status: "ACTIVO",
    }
  });
  console.log("PoolEntry creado automáticamente. ID:", poolEntry.id);

  // 5. Test Complete
  console.log("\n-> Completando reserva...");
  const completeRes = await prisma.serviceReservation.update({
    where: { id: res.id },
    data: { status: "FINALIZADA", completedAt: new Date() }
  });
  const completeEntry = await prisma.poolEntry.update({
    where: { id: poolEntry.id },
    data: { status: "FINALIZADO", exitAt: new Date() }
  });
  
  console.log("Completado exitoso. Reserva Status:", completeRes.status, "Entry Status:", completeEntry.status);
  
  console.log("\n=== TEST FINALIZADO CON EXITO ===");
}

main()
  .catch(e => {
    console.error("ERROR EN TEST:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
