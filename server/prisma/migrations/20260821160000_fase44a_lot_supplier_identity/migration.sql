ALTER TABLE "InventoryLot"
ADD COLUMN "supplierId" INTEGER,
ADD COLUMN "supplierLotCode" TEXT;

ALTER TABLE "PurchaseItem"
ADD COLUMN "supplierLotCode" TEXT;

CREATE INDEX "InventoryLot_supplier_identity_idx"
ON "InventoryLot"("supplierId", "productId", "supplierLotCode", "expiresAt", "unitCost");

ALTER TABLE "InventoryLot"
ADD CONSTRAINT "InventoryLot_supplierId_fkey"
FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
