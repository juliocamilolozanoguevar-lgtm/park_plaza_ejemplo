-- DropForeignKey
ALTER TABLE "OrderStockReservation" DROP CONSTRAINT "OrderStockReservation_orderId_fkey";

-- DropForeignKey
ALTER TABLE "OrderStockReservationItem" DROP CONSTRAINT "OrderStockReservationItem_reservationId_fkey";

-- AlterTable
ALTER TABLE "InventoryLot" ALTER COLUMN "initialQty" SET DATA TYPE DECIMAL(14,4),
ALTER COLUMN "currentQty" SET DATA TYPE DECIMAL(14,4);

-- AlterTable
ALTER TABLE "InventoryMovement" ADD COLUMN     "allocationId" INTEGER,
ADD COLUMN     "inventoryLotId" INTEGER,
ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(14,4),
ALTER COLUMN "beforeQty" SET DATA TYPE DECIMAL(14,4),
ALTER COLUMN "afterQty" SET DATA TYPE DECIMAL(14,4);

-- AlterTable
ALTER TABLE "OrderStockReservationItem" ADD COLUMN     "sourcesJson" JSONB,
ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(14,4);

-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "stock" SET DATA TYPE DECIMAL(14,4),
ALTER COLUMN "minStock" SET DATA TYPE DECIMAL(14,4);

-- AlterTable
ALTER TABLE "RecipeItem" ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(14,4);

-- CreateTable
CREATE TABLE "OrderStockLotAllocation" (
    "id" SERIAL NOT NULL,
    "reservationItemId" INTEGER NOT NULL,
    "inventoryLotId" INTEGER NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderStockLotAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderStockLotAllocation_inventoryLotId_idx" ON "OrderStockLotAllocation"("inventoryLotId");

-- CreateIndex
CREATE INDEX "OrderStockLotAllocation_reservationItemId_idx" ON "OrderStockLotAllocation"("reservationItemId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderStockLotAllocation_reservationItemId_inventoryLotId_key" ON "OrderStockLotAllocation"("reservationItemId", "inventoryLotId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryMovement_allocationId_key" ON "InventoryMovement"("allocationId");

-- AddForeignKey
ALTER TABLE "OrderStockReservation" ADD CONSTRAINT "OrderStockReservation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStockReservationItem" ADD CONSTRAINT "OrderStockReservationItem_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "OrderStockReservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_inventoryLotId_fkey" FOREIGN KEY ("inventoryLotId") REFERENCES "InventoryLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "OrderStockLotAllocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStockLotAllocation" ADD CONSTRAINT "OrderStockLotAllocation_reservationItemId_fkey" FOREIGN KEY ("reservationItemId") REFERENCES "OrderStockReservationItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStockLotAllocation" ADD CONSTRAINT "OrderStockLotAllocation_inventoryLotId_fkey" FOREIGN KEY ("inventoryLotId") REFERENCES "InventoryLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
