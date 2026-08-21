-- CreateEnum
CREATE TYPE "ReservationOrigin" AS ENUM ('WEB', 'RECEPCION', 'ADMIN');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENTE', 'FINALIZADA', 'REQUIERE_REVISION');

-- CreateEnum
CREATE TYPE "MovementOrigin" AS ENUM ('COMPRA', 'PEDIDO', 'PRODUCCION', 'MERMA', 'AJUSTE_MANUAL', 'ENTRADA_MANUAL', 'SALIDA_MANUAL', 'SOLICITUD_INSUMO', 'DANO', 'PERDIDA', 'OTRO');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "InventoryArea" ADD VALUE 'LIMPIEZA';
ALTER TYPE "InventoryArea" ADD VALUE 'MANTENIMIENTO';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RoleName" ADD VALUE 'EVENTOS';
ALTER TYPE "RoleName" ADD VALUE 'MANTENIMIENTO';

-- AlterEnum
ALTER TYPE "UserStatus" ADD VALUE 'SUSPENDIDO';

-- AlterTable
ALTER TABLE "InventoryMovement" ADD COLUMN     "origin" "MovementOrigin",
ADD COLUMN     "unitCost" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "OperationalReport" ADD COLUMN     "assignedToId" INTEGER,
ADD COLUMN     "observations" TEXT,
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "workDescription" TEXT;

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "origin" "ReservationOrigin" NOT NULL DEFAULT 'RECEPCION';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "birthDate" TIMESTAMP(3),
ADD COLUMN     "documentNumber" TEXT,
ADD COLUMN     "hireDate" TIMESTAMP(3),
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "photoUrl" TEXT,
ADD COLUMN     "position" TEXT,
ADD COLUMN     "username" TEXT;

-- CreateTable
CREATE TABLE "AttendanceRecord" (
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
CREATE TABLE "OrderStockReservation" (
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
CREATE TABLE "OrderStockReservationItem" (
    "id" SERIAL NOT NULL,
    "reservationId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unit" TEXT NOT NULL,
    "source" TEXT,

    CONSTRAINT "OrderStockReservationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionBatch" (
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
CREATE INDEX "AttendanceRecord_userId_checkInAt_idx" ON "AttendanceRecord"("userId", "checkInAt");

-- CreateIndex
CREATE INDEX "AttendanceRecord_status_idx" ON "AttendanceRecord"("status");

-- CreateIndex
CREATE UNIQUE INDEX "OrderStockReservation_orderId_key" ON "OrderStockReservation"("orderId");

-- CreateIndex
CREATE INDEX "OrderStockReservation_status_idx" ON "OrderStockReservation"("status");

-- CreateIndex
CREATE INDEX "OrderStockReservationItem_productId_idx" ON "OrderStockReservationItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionBatch_code_key" ON "ProductionBatch"("code");

-- CreateIndex
CREATE INDEX "ProductionBatch_area_idx" ON "ProductionBatch"("area");

-- CreateIndex
CREATE INDEX "ProductionBatch_createdAt_idx" ON "ProductionBatch"("createdAt");

-- CreateIndex
CREATE INDEX "OperationalReport_assignedToId_idx" ON "OperationalReport"("assignedToId");

-- CreateIndex
CREATE UNIQUE INDEX "User_documentNumber_key" ON "User"("documentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_correctedById_fkey" FOREIGN KEY ("correctedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationalReport" ADD CONSTRAINT "OperationalReport_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStockReservation" ADD CONSTRAINT "OrderStockReservation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStockReservationItem" ADD CONSTRAINT "OrderStockReservationItem_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "OrderStockReservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStockReservationItem" ADD CONSTRAINT "OrderStockReservationItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionBatch" ADD CONSTRAINT "ProductionBatch_inputProductId_fkey" FOREIGN KEY ("inputProductId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionBatch" ADD CONSTRAINT "ProductionBatch_outputProductId_fkey" FOREIGN KEY ("outputProductId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

