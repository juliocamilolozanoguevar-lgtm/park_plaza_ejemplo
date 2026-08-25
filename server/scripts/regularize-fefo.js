import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando regularización de stock histórico para FEFO...");

  // 1. Obtener productos activos e inactivos que tengan stock > 0
  const products = await prisma.product.findMany({
    where: { stock: { gt: 0 } }
  });

  console.log(`Productos a evaluar: ${products.length}`);
  
  let createdLots = 0;
  const unresolved = [];
  
  for (const product of products) {
    const prodStock = new Prisma.Decimal(product.stock);

    await prisma.$transaction(async (tx) => {
      // 2. Sumar currentQty de lotes existentes para este producto
      const lotAgg = await tx.inventoryLot.aggregate({
        where: { productId: product.id },
        _sum: { currentQty: true }
      });

      const currentLotSum = new Prisma.Decimal(lotAgg._sum.currentQty || 0);

      // 3. Si lotes < stock y no existe LOT-INICIAL, crear
      if (currentLotSum.lt(prodStock)) {
        const diff = prodStock.minus(currentLotSum);
        
        // Verificar si ya existe un LOT-INICIAL para no duplicarlo por error
        const existingInit = await tx.inventoryLot.findFirst({
          where: { productId: product.id, code: `LOT-INICIAL-P${product.id}` }
        });

        if (!existingInit) {
          const lot = await tx.inventoryLot.create({
            data: {
              code: `LOT-INICIAL-P${product.id}`,
              productId: product.id,
              initialQty: diff,
              currentQty: diff,
              unitCost: product.cost || 0,
              receivedAt: new Date(),
              expiresAt: null // Sin vencimiento por defecto al regularizar
            }
          });
          
          // 4. Insertar directamente InventoryMovement SIN modificar Product.stock
          await tx.inventoryMovement.create({
            data: {
              productId: product.id,
              inventoryLotId: lot.id,
              type: "AJUSTE",
              origin: "AJUSTE_MANUAL",
              quantity: diff,
              beforeQty: prodStock, 
              afterQty: prodStock, // ¡El stock global del producto no cambia!
              unitCost: lot.unitCost,
              reason: "Regularización FEFO: Creación de lote inicial para cubrir stock legacy",
              reference: "REGULARIZACION_FEFO",
            }
          });

          createdLots++;
          console.log(`[OK] Producto ID: ${product.id} - Creado LOT-INICIAL por ${diff.toNumber()} ${product.unit}`);
        } else {
          const message = `Producto ID: ${product.id} - Ya existe LOT-INICIAL pero stock fisico difiere de la suma de lotes. Se requiere revision manual. Diferencia: ${diff.toFixed(4)} ${product.unit}`;
          unresolved.push(message);
          console.log(`[WARN] ${message}`);
        }
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  console.log(`\nRegularización terminada. Se crearon ${createdLots} lotes iniciales.`);
  if (unresolved.length) {
    console.error(`Regularización incompleta. Casos no regularizados: ${unresolved.length}`);
    for (const item of unresolved) console.error(`- ${item}`);
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error("Error durante regularización:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
