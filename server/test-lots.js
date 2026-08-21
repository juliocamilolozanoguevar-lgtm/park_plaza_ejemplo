import { PrismaClient } from "@prisma/client";
import { createPurchase, receivePurchase } from "./src/services/admin.service.js";

const prisma = new PrismaClient();

async function run() {
  try {
    const user = await prisma.user.findFirst();
    const userId = user?.id;

    // Get a product and a supplier
    const product = await prisma.product.findFirst({ where: { active: true } });
    const product2 = await prisma.product.findFirst({ where: { active: true, id: { not: product.id } } });
    
    let supplier = await prisma.supplier.findFirst();
    if (!supplier) {
      supplier = await prisma.supplier.create({ data: { ruc: "12345678901", name: "Test Supplier" } });
    }

    console.log("=== ESTADO INICIAL ===");
    console.log("Product 1 Initial Stock:", product.stock);
    console.log("Product 2 Initial Stock:", product2.stock);

    const initialMovementsCount1 = await prisma.inventoryMovement.count({ where: { productId: product.id } });
    const initialMovementsCount2 = await prisma.inventoryMovement.count({ where: { productId: product2.id } });

    console.log("\n=== 1, 2, 5. COMPRA CON Y SIN VENCIMIENTO ===");
    const purchaseData = {
      supplierId: supplier.id,
      items: [
        { productId: product.id, quantity: 10, cost: 24, expiresAt: "2026-08-31T00:00:00.000Z" },
        { productId: product2.id, quantity: 5, cost: 15.50 }
      ]
    };

    const purchase = await createPurchase(purchaseData, userId);
    console.log("Created Purchase ID:", purchase.id);

    await receivePurchase(purchase.id, userId);
    console.log("-> Purchase received successfully");

    // Verificar lote 1 (con vencimiento)
    const lot1 = await prisma.inventoryLot.findFirst({ where: { purchaseItemId: purchase.items[0].id } });
    console.log(`Lote 1: ${lot1.code} | expiresAt: ${lot1.expiresAt} | unitCost: ${lot1.unitCost}`);

    // Verificar lote 2 (sin vencimiento)
    const lot2 = await prisma.inventoryLot.findFirst({ where: { purchaseItemId: purchase.items[1].id } });
    console.log(`Lote 2: ${lot2.code} | expiresAt: ${lot2.expiresAt} | unitCost: ${lot2.unitCost}`);

    // Verificar InventoryMovement (cantidad y unitCost)
    const currentMovementsCount1 = await prisma.inventoryMovement.count({ where: { productId: product.id } });
    console.log(`InventoryMovements Product 1: ${currentMovementsCount1 - initialMovementsCount1} nuevos (Esperado: 1)`);
    
    const mov1 = await prisma.inventoryMovement.findFirst({
      where: { productId: product.id, origin: 'COMPRA', reference: `COMPRA:${purchase.id}` }
    });
    console.log(`Movement unitCost Product 1: ${mov1.unitCost} (Esperado: 24)`);


    console.log("\n=== 4. RECEPCIÓN DUPLICADA ===");
    try {
      await receivePurchase(purchase.id, userId);
      console.log("FAIL: Permitió recepción duplicada.");
    } catch (e) {
      console.log("PASS: Rechazó recepción duplicada:", e.message);
    }
    const checkDuplicateLots = await prisma.inventoryLot.count({ where: { purchaseItemId: purchase.items[0].id } });
    console.log(`Lotes creados para ítem 1: ${checkDuplicateLots} (Esperado: 1)`);


    console.log("\n=== 3. DOS COMPRAS DISTINTAS ===");
    const purchaseData2 = {
      supplierId: supplier.id,
      items: [{ productId: product.id, quantity: 2, cost: 26, expiresAt: "2026-09-15T00:00:00.000Z" }]
    };
    const purchase2 = await createPurchase(purchaseData2, userId);
    await receivePurchase(purchase2.id, userId);
    
    const lotsP1 = await prisma.inventoryLot.findMany({ 
      where: { productId: product.id, purchaseItemId: { in: [purchase.items[0].id, purchase2.items[0].id] } }
    });
    console.log("Total lotes nuevos para producto 1:", lotsP1.length);
    lotsP1.forEach(l => console.log(`  - ${l.code} (qty: ${l.currentQty})`));

    const finalProduct = await prisma.product.findUnique({ where: { id: product.id } });
    console.log(`Final stock Product 1: ${finalProduct.stock} (Esperado: ${Number(product.stock) + 10 + 2})`);


    console.log("\n=== 6. ATOMICIDAD ===");
    // Para probar atomicidad forzaremos un error manualmente en un mock o usando datos inválidos.
    // Insertamos un purchase válido, pero modificamos su supplierId para que rompa la FK o similar, 
    // o enviamos quantity negativo que InventoryMovement.create o algo rompa,
    // o simplemente creamos un Purchase real pero simulamos un error de constraint.
    const atomicPurchase = await createPurchase({
      supplierId: supplier.id,
      items: [{ productId: product.id, quantity: 1, cost: 10 }]
    }, userId);

    // Sobreescribir el productId con uno inexistente directo en DB para romper FK al crear Movement
    await prisma.purchaseItem.updateMany({
      where: { purchaseId: atomicPurchase.id },
      data: { productId: 999999 }
    });

    try {
      await receivePurchase(atomicPurchase.id, userId);
      console.log("FAIL: La compra se recibió a pesar de tener un productId inválido");
    } catch(e) {
      console.log("PASS: Error capturado durante recepción (FK violation)");
    }

    const atomicLots = await prisma.inventoryLot.count({ where: { purchaseItemId: atomicPurchase.items[0].id } });
    console.log(`Lotes creados durante fallo atómico: ${atomicLots} (Esperado: 0)`);


    console.log("\n=== RESUMEN FINAL ===");
    console.log("Todo completado sin excepciones no controladas.");

  } catch (err) {
    console.error("UNHANDLED ERROR:", err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
