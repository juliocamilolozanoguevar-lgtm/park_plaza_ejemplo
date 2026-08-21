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
  await prisma.orderStockReservationItem.deleteMany({ where: { product: { name: { in: ["TEST_PRODUCT_FEFO", "Tie Prod", "Dec Prod"] } } } });
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

fs.writeFileSync('test-fefo.js', code);
