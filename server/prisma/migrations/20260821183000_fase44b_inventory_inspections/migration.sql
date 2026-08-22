CREATE TYPE "InventoryInspectionStatus" AS ENUM ('PENDIENTE', 'APTO', 'NO_APTO');

CREATE TABLE "InventoryInspection" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "inventoryLotId" INTEGER NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "area" "InventoryArea" NOT NULL,
    "status" "InventoryInspectionStatus" NOT NULL DEFAULT 'PENDIENTE',
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "storageLocation" TEXT,
    "reference" TEXT,
    "createdById" INTEGER,
    "resolvedById" INTEGER,
    "resolutionNotes" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryInspection_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "InventoryInspection_quantity_check" CHECK ("quantity" > 0)
);

CREATE INDEX "InventoryInspection_status_idx" ON "InventoryInspection"("status");
CREATE INDEX "InventoryInspection_productId_idx" ON "InventoryInspection"("productId");
CREATE INDEX "InventoryInspection_inventoryLotId_idx" ON "InventoryInspection"("inventoryLotId");
CREATE INDEX "InventoryInspection_area_idx" ON "InventoryInspection"("area");
CREATE INDEX "InventoryInspection_createdAt_idx" ON "InventoryInspection"("createdAt");

ALTER TABLE "InventoryInspection"
ADD CONSTRAINT "InventoryInspection_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InventoryInspection"
ADD CONSTRAINT "InventoryInspection_inventoryLotId_fkey"
FOREIGN KEY ("inventoryLotId") REFERENCES "InventoryLot"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InventoryInspection"
ADD CONSTRAINT "InventoryInspection_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InventoryInspection"
ADD CONSTRAINT "InventoryInspection_resolvedById_fkey"
FOREIGN KEY ("resolvedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
