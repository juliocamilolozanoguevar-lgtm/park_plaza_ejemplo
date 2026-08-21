-- AlterTable
ALTER TABLE "PurchaseItem" ADD COLUMN "expiresAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "InventoryLot" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "initialQty" DECIMAL(10,2) NOT NULL,
    "currentQty" DECIMAL(10,2) NOT NULL,
    "unitCost" DECIMAL(10,2) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "purchaseItemId" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryLot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InventoryLot_code_key" ON "InventoryLot"("code");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryLot_purchaseItemId_key" ON "InventoryLot"("purchaseItemId");

-- AddForeignKey
ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_purchaseItemId_fkey" FOREIGN KEY ("purchaseItemId") REFERENCES "PurchaseItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
