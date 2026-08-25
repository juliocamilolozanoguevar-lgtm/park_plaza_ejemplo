ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_currentQty_check" CHECK ("currentQty" >= 0);
ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_initialQty_check" CHECK ("initialQty" >= 0);
