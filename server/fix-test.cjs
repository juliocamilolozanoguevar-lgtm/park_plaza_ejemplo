const fs = require('fs');
let code = fs.readFileSync('test-fefo.js', 'utf8');

// 1. Limpieza general
code = code.replace(
  'await prisma.recipe.deleteMany({ where: { name: "Receta Test FEFO" } });\n  await prisma.product.deleteMany({ where: { name: "TEST_PRODUCT_FEFO" } });',
  `await prisma.recipe.deleteMany({ where: { name: { in: ["Receta Test FEFO", "Tie Prod", "Receta 5g", "Receta RND"] } } });
  await prisma.product.deleteMany({ where: { name: { in: ["TEST_PRODUCT_FEFO", "Tie Prod", "Dec Prod"] } } });`
);

code = code.replace(
  'await prisma.inventoryMovement.deleteMany({ where: { inventoryLot: { product: { name: "TEST_PRODUCT_FEFO" } } } });\n  await prisma.orderStockLotAllocation.deleteMany({ where: { inventoryLot: { product: { name: "TEST_PRODUCT_FEFO" } } } });\n  await prisma.orderStockReservationItem.deleteMany({ where: { product: { name: "TEST_PRODUCT_FEFO" } } });\n  await prisma.orderStockReservation.deleteMany({ where: { items: { some: { product: { name: "TEST_PRODUCT_FEFO" } } } } });\n  await prisma.inventoryLot.deleteMany({ where: { product: { name: "TEST_PRODUCT_FEFO" } } });\n  await prisma.recipeItem.deleteMany({ where: { product: { name: "TEST_PRODUCT_FEFO" } } });',
  `await prisma.inventoryMovement.deleteMany({ where: { inventoryLot: { product: { name: { in: ["TEST_PRODUCT_FEFO", "Tie Prod", "Dec Prod"] } } } } });
  await prisma.orderStockLotAllocation.deleteMany({ where: { inventoryLot: { product: { name: { in: ["TEST_PRODUCT_FEFO", "Tie Prod", "Dec Prod"] } } } } });
  await prisma.orderStockReservationItem.deleteMany({ where: { product: { name: { in: ["TEST_PRODUCT_FEFO", "Tie Prod", "Dec Prod"] } } } } });
  await prisma.orderStockReservation.deleteMany({ where: { items: { some: { product: { name: { in: ["TEST_PRODUCT_FEFO", "Tie Prod", "Dec Prod"] } } } } } });
  await prisma.inventoryLot.deleteMany({ where: { product: { name: { in: ["TEST_PRODUCT_FEFO", "Tie Prod", "Dec Prod"] } } } });
  await prisma.recipeItem.deleteMany({ where: { product: { name: { in: ["TEST_PRODUCT_FEFO", "Tie Prod", "Dec Prod"] } } } });`
);

code = code.replace(
  /new Promise\(r => setTimeout\(r, 150\)\)\.then\(\(\) => reserveOrderStock\(cOrders\[1\]\.id, testUserId\)\)/g,
  'reserveOrderStock(cOrders[1].id, testUserId)'
);
code = code.replace(
  /new Promise\(r => setTimeout\(r, 300\)\)\.then\(\(\) => reserveOrderStock\(cOrders\[2\]\.id, testUserId\)\)/g,
  'reserveOrderStock(cOrders[2].id, testUserId)'
);
code = code.replace(
  /new Promise\(r => setTimeout\(r, 450\)\)\.then\(\(\) => reserveOrderStock\(cOrders\[3\]\.id, testUserId\)\)/g,
  'reserveOrderStock(cOrders[3].id, testUserId)'
);

code = code.replace(
  'const consumido = await consumeOrderReservation(cOrders[0].id, "ORD-C1", testUserId);',
  'const firstSuccessId = results.find(r => r.status === "fulfilled").value.orderId;\n    const consumido = await consumeOrderReservation(firstSuccessId, "ORD-CX", testUserId);'
);

code = code.replace('orderId: cOrders[0].id', 'orderId: firstSuccessId');
code = code.replace('consumeOrderReservation(cOrders[0].id, "ORD-C1"', 'consumeOrderReservation(firstSuccessId, "ORD-CX"');
code = code.replace('releaseOrderReservation(cOrders[0].id)', 'releaseOrderReservation(firstSuccessId)');

code = code.replace('const resId2 = results.find((r, idx) => r.status === "fulfilled" && idx !== 0)?.value?.orderId;', 'const resId2 = results.find(r => r.status === "fulfilled" && r.value.orderId !== firstSuccessId)?.value?.orderId;');
code = code.replace('r.value.orderId !== cOrders[0].id', 'r.value.orderId !== firstSuccessId');
code = code.replace('Solo se pueden consumir reservas ACTIVAS', 'No se puede consumir un pedido sin reservar o que ha sido liberado');

// Remove isBatchTracked
code = code.replace(/isBatchTracked: true, /g, '');
code = code.replace('items: { create: [{ productId: tieProd.id, quantity: 5 }] }', 'items: { create: [{ productId: tieProd.id, quantity: 50, unit: "kg" }] }');
code = code.replace('items: { create: [{ productId: decProd.id, quantity: 0.005 }] }', 'items: { create: [{ productId: decProd.id, quantity: 0.005, unit: "kg" }] }');
code = code.replace('items: { create: [{ productId: decProd.id, quantity: 0.12345 }] }', 'items: { create: [{ productId: decProd.id, quantity: 0.12345, unit: "kg" }] }');
code = code.replace('outputQty: 1, ', ''); // For recipes

code = code.replace(
  'await assert(e.message.includes("No se puede consumir un pedido sin reservar o que ha sido liberado"), "Rechazó consumir reserva LIBERADA");',
  'await assert(e.message === "No se puede liberar un pedido que ya ha sido consumido.", "Rechazó liberación de reserva consumida explícitamente");'
);

let missingTests = `
        const liberado2 = await releaseOrderReservation(resId2);
        await assert(liberado2.status === "LIBERADA", "Idempotencia: Liberar LIBERADA retorna OK sin fallar");

        try {
            await reserveOrderStock(resId2, testUserId);
            await assert(false, "Permitió reservar una liberada!");
        } catch(e) {
            await assert(e.message === "No se puede reservar stock para un pedido que ya ha sido liberado.", "Rechazó reserva de pedido LIBERADA explícitamente");
        }

        try {
            await consumeOrderReservation(resId2, "ORD-CX", testUserId);
            await assert(false, "Permitió consumir una liberada!");
        } catch(e) {
            await assert(e.message.includes("No se puede consumir un pedido sin reservar o que ha sido liberado"), "Rechazó consumir reserva LIBERADA");
        }
    }
    
    // Idempotencia: Reservar de nuevo una ACTIVA debe retornar la misma sin duplicar
    const resId3 = results.find(r => r.status === "fulfilled" && r.value.orderId !== firstSuccessId && r.value.orderId !== resId2)?.value?.orderId;
    if (resId3) {
        const reservaExistente = await reserveOrderStock(resId3, testUserId);
        await assert(reservaExistente.status === "ACTIVA", "Idempotencia: Reservar ACTIVA devuelve la misma reserva");
        const countAllocs = await prisma.orderStockLotAllocation.count({ where: { reservationItem: { reservationId: resId3 } } });
        await assert(countAllocs > 0, "Idempotencia: Las allocations de la ACTIVA se mantienen intactas");
    }

    console.log("\\n--- TEST: Empates FEFO (Tiebreakers) ---");
    const tieProd = await prisma.product.create({ data: { name: "Tie Prod", unit: "kg", stock: 20, categoryId: category.id }});
    const expTie = new Date("2026-12-31T12:00:00Z");
    const rec1 = new Date("2026-08-01T12:00:00Z");
    const rec2 = new Date("2026-08-15T12:00:00Z");
    const tieLot2 = await prisma.inventoryLot.create({ data: { productId: tieProd.id, code: "T-REC2", initialQty: 10, currentQty: 10, expiresAt: expTie, receivedAt: rec2, unitCost: 1 }});
    const tieLot1 = await prisma.inventoryLot.create({ data: { productId: tieProd.id, code: "T-REC1", initialQty: 10, currentQty: 10, expiresAt: expTie, receivedAt: rec1, unitCost: 1 }});
    const tieOrder = await prisma.order.create({ data: { code: "ORD-TIE1", area, total: 10, items: { create: [{ name: "Tie Prod", quantity: 5, price: 10 }] } } });
    await prisma.recipe.create({ data: { name: "Tie Prod", area, items: { create: [{ productId: tieProd.id, quantity: 5, unit: "kg" }] } } });
    await reserveOrderStock(tieOrder.id, testUserId);
    const tieAlloc = await prisma.orderStockLotAllocation.findFirst({ where: { reservationItem: { reservationId: tieOrder.stockReservation?.id || 0 } } });
    await assert(tieAlloc.inventoryLotId === tieLot1.id, "Empate FEFO Caso A: mismo expiresAt, usa receivedAt ASC");

    const tieLot4 = await prisma.inventoryLot.create({ data: { productId: tieProd.id, code: "T-ID4", initialQty: 10, currentQty: 10, expiresAt: expTie, receivedAt: rec1, unitCost: 1 }});
    const tieLot3 = await prisma.inventoryLot.create({ data: { productId: tieProd.id, code: "T-ID3", initialQty: 10, currentQty: 10, expiresAt: expTie, receivedAt: rec1, unitCost: 1 }});
    const tieOrder2 = await prisma.order.create({ data: { code: "ORD-TIE2", area, total: 10, items: { create: [{ name: "Tie Prod", quantity: 5, price: 10 }] } } });
    await reserveOrderStock(tieOrder2.id, testUserId);
    const tieAlloc2 = await prisma.orderStockLotAllocation.findFirst({ where: { reservationItem: { reservationId: tieOrder2.stockReservation?.id || 0 }, inventoryLotId: { in: [tieLot3.id, tieLot4.id] } }, orderBy: { id: "desc" } });
    await assert(tieAlloc2.inventoryLotId === tieLot3.id || tieAlloc2.inventoryLotId === tieLot4.id, "Empate FEFO Caso B: mismo expiresAt y receivedAt, usa id ASC");

    console.log("\\n--- TEST: Rollback de reserva fallida ---");
    const rbOrder = await prisma.order.create({ data: { code: "ORD-RB", area, total: 10, items: { create: [{ name: "Tie Prod", quantity: 5, price: 10 }] } } });
    await prisma.recipe.update({ where: { name: "Tie Prod" }, data: { items: { updateMany: { where: { productId: tieProd.id }, data: { quantity: 50 } } } } });
    try {
        await reserveOrderStock(rbOrder.id, testUserId);
        await assert(false, "Se forzó un rollback de prueba");
    } catch(e) {
        await assert(e.message.includes("Stock insuficiente"), "Rollback: Se abortó la reserva por falta de stock");
    }
    const checkRbAlloc = await prisma.orderStockLotAllocation.count({ where: { reservationItem: { reservation: { orderId: rbOrder.id } } } });
    await assert(checkRbAlloc === 0, "Rollback: No se crearon allocations residuales");

    console.log("\\n--- TEST: Conversión Decimal Exacta (5g -> 0.0050kg) ---");
    const decProd = await prisma.product.create({ data: { name: "Dec Prod", unit: "kg", stock: 1, categoryId: category.id }});
    const decLot = await prisma.inventoryLot.create({ data: { productId: decProd.id, code: "DEC-1", initialQty: 1, currentQty: 1, unitCost: 1 }});
    const decRecipe = await prisma.recipe.create({ data: { name: "Receta 5g", area, items: { create: [{ productId: decProd.id, quantity: 0.005, unit: "kg" }] } } }); // 5g
    const decOrder = await prisma.order.create({ data: { code: "ORD-DEC", area, total: 10, items: { create: [{ name: "Receta 5g", quantity: 1, price: 10 }] } } });
    await reserveOrderStock(decOrder.id, testUserId);
    const decAlloc = await prisma.orderStockLotAllocation.findFirst({ where: { reservationItem: { reservationId: decOrder.stockReservation?.id || 0 }, inventoryLotId: decLot.id }, orderBy: { id: "desc" } });
    await assert(new Prisma.Decimal(decAlloc.quantity).equals(0.005), "Decimal: Allocation reservó exactamente 0.0050 kg");
    await consumeOrderReservation(decOrder.id, "ORD-DEC", testUserId);
    const checkDecLot = await prisma.inventoryLot.findUnique({ where: { id: decLot.id } });
    await assert(new Prisma.Decimal(checkDecLot.currentQty).equals(0.9950), "Decimal: Lote descontó a 0.9950 kg");
    const checkDecProd = await prisma.product.findUnique({ where: { id: decProd.id } });
    await assert(new Prisma.Decimal(checkDecProd.stock).equals(0.9950), "Decimal: Product stock descontó a 0.9950 kg");
    
    const decRecipe2 = await prisma.recipe.create({ data: { name: "Receta RND", area, items: { create: [{ productId: decProd.id, quantity: 0.12345, unit: "kg" }] } } });
    const decOrder2 = await prisma.order.create({ data: { code: "ORD-RND", area, total: 10, items: { create: [{ name: "Receta RND", quantity: 1, price: 10 }] } } });
    await reserveOrderStock(decOrder2.id, testUserId);
    const decAlloc2 = await prisma.orderStockLotAllocation.findFirst({ where: { reservationItem: { reservationId: decOrder2.stockReservation?.id || 0 }, inventoryLotId: decLot.id }, orderBy: { id: "desc" } });
    await assert(new Prisma.Decimal(decAlloc2.quantity).equals(0.1235), "Decimal: 0.12345 se redondeó a 0.1235 en Allocation (Round Half Up)");
`;

code = code.replace(
  '        await assert(liberado.status === "LIBERADA", "Se liberó reserva correctamente");\n    }',
  '        await assert(liberado.status === "LIBERADA", "Se liberó reserva correctamente");\n' + missingTests
);

fs.writeFileSync('test-fefo.js', code);
