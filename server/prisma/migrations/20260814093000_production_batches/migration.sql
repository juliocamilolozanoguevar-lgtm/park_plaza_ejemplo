CREATE TABLE IF NOT EXISTS "ProductionBatch" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "area" "InventoryArea" NOT NULL DEFAULT 'RESTAURANTE',
    "inputProductId" INTEGER NOT NULL,
    "outputProductId" INTEGER NOT NULL,
    "inputQty" DECIMAL(10,2) NOT NULL,
    "outputQty" DECIMAL(10,2) NOT NULL,
    "wasteQty" DECIMAL(10,2) NOT NULL,
    "yieldPercent" DECIMAL(5,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'FINALIZADA',
    "notes" TEXT,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductionBatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProductionBatch_code_key" ON "ProductionBatch"("code");
CREATE INDEX IF NOT EXISTS "ProductionBatch_area_idx" ON "ProductionBatch"("area");
CREATE INDEX IF NOT EXISTS "ProductionBatch_createdAt_idx" ON "ProductionBatch"("createdAt");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ProductionBatch_inputProductId_fkey'
    ) THEN
        ALTER TABLE "ProductionBatch"
        ADD CONSTRAINT "ProductionBatch_inputProductId_fkey"
        FOREIGN KEY ("inputProductId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ProductionBatch_outputProductId_fkey'
    ) THEN
        ALTER TABLE "ProductionBatch"
        ADD CONSTRAINT "ProductionBatch_outputProductId_fkey"
        FOREIGN KEY ("outputProductId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;
