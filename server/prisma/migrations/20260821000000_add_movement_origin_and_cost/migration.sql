-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ReservationOrigin" AS ENUM ('WEB', 'RECEPCION', 'ADMIN');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENTE', 'FINALIZADA', 'REQUIERE_REVISION');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "MovementOrigin" AS ENUM ('COMPRA', 'PEDIDO', 'PRODUCCION', 'MERMA', 'AJUSTE_MANUAL', 'ENTRADA_MANUAL', 'SALIDA_MANUAL', 'SOLICITUD_INSUMO', 'DANO', 'PERDIDA', 'OTRO');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "InventoryArea" ADD VALUE IF NOT EXISTS 'LIMPIEZA';
ALTER TYPE "InventoryArea" ADD VALUE IF NOT EXISTS 'MANTENIMIENTO';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RoleName" ADD VALUE IF NOT EXISTS 'EVENTOS';
ALTER TYPE "RoleName" ADD VALUE IF NOT EXISTS 'MANTENIMIENTO';

-- AlterEnum
ALTER TYPE "UserStatus" ADD VALUE IF NOT EXISTS 'SUSPENDIDO';

-- AlterTable
ALTER TABLE "InventoryMovement"
ADD COLUMN IF NOT EXISTS "origin" "MovementOrigin",
ADD COLUMN IF NOT EXISTS "unitCost" DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS "reference" TEXT,
ADD COLUMN IF NOT EXISTS "createdById" INTEGER;

-- AlterTable
ALTER TABLE "OperationalReport"
ADD COLUMN IF NOT EXISTS "assignedToId" INTEGER,
ADD COLUMN IF NOT EXISTS "observations" TEXT,
ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "workDescription" TEXT;

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "origin" "ReservationOrigin" NOT NULL DEFAULT 'RECEPCION';

-- AlterTable
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "birthDate" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "documentNumber" TEXT,
ADD COLUMN IF NOT EXISTS "hireDate" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "phone" TEXT,
ADD COLUMN IF NOT EXISTS "photoUrl" TEXT,
ADD COLUMN IF NOT EXISTS "position" TEXT,
ADD COLUMN IF NOT EXISTS "username" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "AttendanceRecord" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "checkInAt" TIMESTAMP(3) NOT NULL,
    "checkOutAt" TIMESTAMP(3),
    "durationMinutes" INTEGER,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENTE',
    "reviewReason" TEXT,
    "correctedById" INTEGER,
    "correctionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE IF NOT EXISTS "OrderStockReservationItem" (
    "id" SERIAL NOT NULL,
    "reservationId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unit" TEXT NOT NULL,
    "source" TEXT,

    CONSTRAINT "OrderStockReservationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AttendanceRecord_userId_checkInAt_idx" ON "AttendanceRecord"("userId", "checkInAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AttendanceRecord_status_idx" ON "AttendanceRecord"("status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "OrderStockReservation_orderId_key" ON "OrderStockReservation"("orderId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OrderStockReservation_status_idx" ON "OrderStockReservation"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OrderStockReservationItem_productId_idx" ON "OrderStockReservationItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ProductionBatch_code_key" ON "ProductionBatch"("code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProductionBatch_area_idx" ON "ProductionBatch"("area");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProductionBatch_createdAt_idx" ON "ProductionBatch"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OperationalReport_assignedToId_idx" ON "OperationalReport"("assignedToId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_documentNumber_key" ON "User"("documentNumber");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AttendanceRecord_userId_fkey') THEN
    ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AttendanceRecord_correctedById_fkey') THEN
    ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_correctedById_fkey" FOREIGN KEY ("correctedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OperationalReport_assignedToId_fkey') THEN
    ALTER TABLE "OperationalReport" ADD CONSTRAINT "OperationalReport_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OrderStockReservation_orderId_fkey') THEN
    ALTER TABLE "OrderStockReservation" ADD CONSTRAINT "OrderStockReservation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OrderStockReservationItem_reservationId_fkey') THEN
    ALTER TABLE "OrderStockReservationItem" ADD CONSTRAINT "OrderStockReservationItem_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "OrderStockReservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OrderStockReservationItem_productId_fkey') THEN
    ALTER TABLE "OrderStockReservationItem" ADD CONSTRAINT "OrderStockReservationItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryMovement_createdById_fkey') THEN
    ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProductionBatch_inputProductId_fkey') THEN
    ALTER TABLE "ProductionBatch" ADD CONSTRAINT "ProductionBatch_inputProductId_fkey" FOREIGN KEY ("inputProductId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProductionBatch_outputProductId_fkey') THEN
    ALTER TABLE "ProductionBatch" ADD CONSTRAINT "ProductionBatch_outputProductId_fkey" FOREIGN KEY ("outputProductId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

