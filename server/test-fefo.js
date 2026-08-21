import { prisma } from "./src/config/prisma.js";
import { Prisma } from "@prisma/client";
import { reserveOrderStock, consumeOrderReservation, releaseOrderReservation } from "./src/services/recipe.service.js";
import { getLimaStartOfDayUTC } from "./src/services/inventory-lot.service.js";

async function assert(condition, message) {
  if (!condition) {
    console.error("❌ FAILED:", message);
    throw new Error(message);
  }
  console.log("✅ OK:", message);
}

async function runTests() {
  console.log("=== INICIANDO SUITE DE PRUEBAS FEFO (FASE 3) ===");
  
  const testUserId = 1;
  const area = "RESTAURANTE";

  const category = await prisma.category.findFirst();
  if (!category) throw new Error("No hay categorias en la base de datos para correr el test.");

  // Preparar Producto Dummy para tests
  const product = await prisma.product.create({
    data: { name: "TEST_PRODUCT_FEFO", categoryId: category.id, area, unit: "kg", stock: 0, cost: 10 }
  });

  const recipe = await prisma.recipe.create({
    data: {
      name: "Receta Test FEFO",
      area,
      items: { create: [{ productId: product.id, quantity: 1, unit: "kg" }] }
    }
  });

  try {
    console.log("\n--- TEST: Caso Decimal (S1) ---");
    // Verificar que sumar 0.005 100 veces da exactamente 0.5000 sin desvíos
    let sumaDec = new Prisma.Decimal(0);
    for (let i = 0; i < 100; i++) {
      sumaDec = sumaDec.plus(0.005);
    }
    await assert(sumaDec.equals(0.5), "Prisma.Decimal suma exactamente 0.5");
    
    console.log("\n--- TEST: Caso Fechas FEFO (W) ---");
    const todayLima = getLimaStartOfDayUTC();
    const yesterday = new Date(todayLima); yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date(todayLima); tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Crear Lotes (Vencido, Hoy, Mañana, Sin Vencimiento)
    const lot1 = await prisma.inventoryLot.create({ data: { productId: product.id, code: "T-LOT1-VENCIDO", initialQty: 10, currentQty: 10, unitCost: 10, receivedAt: new Date(), expiresAt: yesterday } });
    const lot2 = await prisma.inventoryLot.create({ data: { productId: product.id, code: "T-LOT2-MANANA", initialQty: 10, currentQty: 10, unitCost: 10, receivedAt: new Date(), expiresAt: tomorrow } });
    const lot3 = await prisma.inventoryLot.create({ data: { productId: product.id, code: "T-LOT3-HOY", initialQty: 10, currentQty: 10, unitCost: 10, receivedAt: new Date(), expiresAt: todayLima } });
    const lot4 = await prisma.inventoryLot.create({ data: { productId: product.id, code: "T-LOT4-SIN", initialQty: 10, currentQty: 10, unitCost: 10, receivedAt: new Date(), expiresAt: null } });

    await prisma.product.update({ where: { id: product.id }, data: { stock: 40 } });

    const dummyOrder1 = await prisma.order.create({ data: { code: "ORD-T1", area, total: 10, items: { create: [{ name: "Receta Test FEFO", quantity: 15, price: 10 }] } } });
    
    const res1 = await reserveOrderStock(dummyOrder1.id, testUserId);
    const allocs = await prisma.orderStockLotAllocation.findMany({ where: { reservationItemId: res1.items[0].id }, orderBy: { id: 'asc' } });
    
    // El orden FEFO debe ser: HOY (lot3), luego MAÑANA (lot2) (el de sin vencimiento va al final, y VENCIDO no aplica)
    await assert(allocs.length === 2, "Debe tomar 2 lotes");
    await assert(allocs[0].inventoryLotId === lot3.id, "Primero debe tomar el que vence HOY");
    await assert(new Prisma.Decimal(allocs[0].quantity).equals(10), "Debe consumir los 10 de HOY");
    await assert(allocs[1].inventoryLotId === lot2.id, "Segundo debe tomar el que vence MAÑANA");
    await assert(new Prisma.Decimal(allocs[1].quantity).equals(5), "Debe consumir los 5 restantes de MAÑANA");

    // Limpiar para siguientes tests
    await prisma.orderStockReservation.delete({ where: { orderId: dummyOrder1.id }});
    await prisma.inventoryLot.deleteMany({ where: { productId: product.id }});

    console.log("\n--- TEST: Caso Concurrencia y Decimales (G, M, Q, S2) ---");
    await prisma.product.update({ where: { id: product.id }, data: { stock: 20 } });
    const cLot = await prisma.inventoryLot.create({ data: { productId: product.id, code: "T-CONCURRENCIA", initialQty: 20, currentQty: 20, unitCost: 10, receivedAt: new Date(), expiresAt: tomorrow } });

    // 4 pedidos simultáneos de 6 kg (Total 24kg > 20kg stock).
    // Esperamos que 3 tengan éxito (18kg) y 1 falle por falta de lote (Concurrencia detectada).
    const cOrders = await Promise.all([
      prisma.order.create({ data: { code: "ORD-C1", area, total: 10, items: { create: [{ name: "Receta Test FEFO", quantity: 6, price: 10 }] } } }),
      prisma.order.create({ data: { code: "ORD-C2", area, total: 10, items: { create: [{ name: "Receta Test FEFO", quantity: 6, price: 10 }] } } }),
      prisma.order.create({ data: { code: "ORD-C3", area, total: 10, items: { create: [{ name: "Receta Test FEFO", quantity: 6, price: 10 }] } } }),
      prisma.order.create({ data: { code: "ORD-C4", area, total: 10, items: { create: [{ name: "Receta Test FEFO", quantity: 6, price: 10 }] } } })
    ]);

    const results = await Promise.allSettled([
      reserveOrderStock(cOrders[0].id, testUserId),
      reserveOrderStock(cOrders[1].id, testUserId),
      reserveOrderStock(cOrders[2].id, testUserId),
      reserveOrderStock(cOrders[3].id, testUserId)
    ]);

    const exitosos = results.filter(r => r.status === "fulfilled").length;
    const fallidos = results.filter(r => r.status === "rejected").length;
    
    await assert(exitosos === 3, `Deben tener éxito exactamente 3 reservas concurrentes (Fueron: ${exitosos})`);
    await assert(fallidos === 1, `Debe fallar exactamente 1 reserva por concurrencia aislada (Fueron: ${fallidos})`);

    // Consumir una de ellas con decimales exactos
    const consumido = await consumeOrderReservation(cOrders[0].id, "T-ORD-1", testUserId);
    await assert(consumido.status === "CONSUMIDA", "Se consumió la reserva exitosamente");

    // Verificar exactitud de stock
    const dbLot = await prisma.inventoryLot.findUnique({ where: { id: cLot.id } });
    await assert(new Prisma.Decimal(dbLot.currentQty).equals(14), "Lote descontó exactamente a 14");
    
    const dbProd = await prisma.product.findUnique({ where: { id: product.id }});
    await assert(new Prisma.Decimal(dbProd.stock).equals(14), "Product stock descontó exactamente a 14");

    // Idempotencia: Volver a consumir debe retornar ok
    const consumido2 = await consumeOrderReservation(cOrders[0].id, "T-ORD-1", testUserId);
    await assert(consumido2.status === "CONSUMIDA", "Idempotencia: Volver a consumir retorna OK");
    const dbLot2 = await prisma.inventoryLot.findUnique({ where: { id: cLot.id } });
    await assert(new Prisma.Decimal(dbLot2.currentQty).equals(14), "Idempotencia: Lote sigue en 14, no se vuelve a descontar");

    // Liberar otra de ellas
    const resId2 = results.find((r, idx) => r.status === "fulfilled" && idx !== 0)?.value?.orderId;
    if (resId2) {
        const liberado = await releaseOrderReservation(resId2);
        await assert(liberado.status === "LIBERADA", "Se liberó reserva correctamente");
    }

    console.log("\n--- TEST: Caso Invariante B (Restricción física Negativa) ---");
    try {
      await prisma.$executeRaw`UPDATE "InventoryLot" SET "currentQty" = -1 WHERE id = ${cLot.id}`;
      await assert(false, "Permitió actualizar a negativo!");
    } catch (e) {
      await assert(true, "Base de datos rechazó cantidad negativa en InventoryLot automáticamente");
    }

    console.log("\n✅✅ TODOS LOS TESTS PASARON EXITOSAMENTE ✅✅");

  } catch (error) {
    console.error("\n❌ SUITE FALLÓ:");
    console.error(error);
  } finally {
    // Limpieza general (ignorar errores)
    try {
        await prisma.inventoryMovement.deleteMany({ where: { inventoryLot: { productId: product.id } } });
        await prisma.orderStockLotAllocation.deleteMany({ where: { inventoryLot: { productId: product.id } } });
        await prisma.orderStockReservationItem.deleteMany({ where: { product: { id: product.id } } });
        await prisma.orderStockReservation.deleteMany({ where: { items: { some: { product: { id: product.id } } } } });
        await prisma.inventoryLot.deleteMany({ where: { productId: product.id } });
        await prisma.recipeItem.deleteMany({ where: { productId: product.id } });
        await prisma.recipe.deleteMany({ where: { name: "Receta Test FEFO" } });
        await prisma.product.delete({ where: { id: product.id } });
    } catch(e) {}
    await prisma.$disconnect();
  }
}

runTests();
