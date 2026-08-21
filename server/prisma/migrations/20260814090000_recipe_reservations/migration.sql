CREATE TABLE IF NOT EXISTS "Recipe" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "area" "InventoryArea" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RecipeItem" (
    "id" SERIAL NOT NULL,
    "recipeId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unit" TEXT NOT NULL,
    CONSTRAINT "RecipeItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OrderStockReservation" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVA',
    "createdById" INTEGER,
    "consumedAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrderStockReservation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OrderStockReservationItem" (
    "id" SERIAL NOT NULL,
    "reservationId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unit" TEXT NOT NULL,
    "source" TEXT,
    CONSTRAINT "OrderStockReservationItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Recipe_name_area_key" ON "Recipe"("name", "area");
CREATE UNIQUE INDEX IF NOT EXISTS "OrderStockReservation_orderId_key" ON "OrderStockReservation"("orderId");
CREATE INDEX IF NOT EXISTS "OrderStockReservation_status_idx" ON "OrderStockReservation"("status");
CREATE INDEX IF NOT EXISTS "OrderStockReservationItem_productId_idx" ON "OrderStockReservationItem"("productId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'RecipeItem_recipeId_fkey'
    ) THEN
        ALTER TABLE "RecipeItem"
        ADD CONSTRAINT "RecipeItem_recipeId_fkey"
        FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'RecipeItem_productId_fkey'
    ) THEN
        ALTER TABLE "RecipeItem"
        ADD CONSTRAINT "RecipeItem_productId_fkey"
        FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'OrderStockReservation_orderId_fkey'
    ) THEN
        ALTER TABLE "OrderStockReservation"
        ADD CONSTRAINT "OrderStockReservation_orderId_fkey"
        FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'OrderStockReservationItem_reservationId_fkey'
    ) THEN
        ALTER TABLE "OrderStockReservationItem"
        ADD CONSTRAINT "OrderStockReservationItem_reservationId_fkey"
        FOREIGN KEY ("reservationId") REFERENCES "OrderStockReservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'OrderStockReservationItem_productId_fkey'
    ) THEN
        ALTER TABLE "OrderStockReservationItem"
        ADD CONSTRAINT "OrderStockReservationItem_productId_fkey"
        FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;
