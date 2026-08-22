-- CreateEnum
CREATE TYPE "ConsumptionStatus" AS ENUM ('PENDIENTE', 'PAGADO', 'ANULADO');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('REGISTRADO', 'ANULADO');

-- CreateEnum
CREATE TYPE "PoolEntryStatus" AS ENUM ('ACTIVO', 'FINALIZADO');

-- CreateEnum
CREATE TYPE "PoolReportType" AS ENUM ('QUEJA', 'INCIDENTE', 'ACCIDENTE', 'PROBLEMA_SERVICIO', 'OBSERVACION', 'OTRO');

-- CreateEnum
CREATE TYPE "CleaningReportType" AS ENUM ('DANO', 'OBJETO_PERDIDO', 'FALTA_INSUMO', 'MANTENIMIENTO', 'INCIDENCIA', 'OBSERVACION');

-- AlterEnum
BEGIN;
CREATE TYPE "CashMovementType_new" AS ENUM ('INGRESO', 'EGRESO');
ALTER TABLE "CashMovement" ALTER COLUMN "type" TYPE "CashMovementType_new" USING ("type"::text::"CashMovementType_new");
ALTER TYPE "CashMovementType" RENAME TO "CashMovementType_old";
ALTER TYPE "CashMovementType_new" RENAME TO "CashMovementType";
DROP TYPE "public"."CashMovementType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "OrderArea_new" AS ENUM ('RESTAURANTE', 'BARTENDER', 'PISCINA', 'EVENTO', 'OTRO');
ALTER TABLE "Order" ALTER COLUMN "area" TYPE "OrderArea_new" USING ("area"::text::"OrderArea_new");
ALTER TYPE "OrderArea" RENAME TO "OrderArea_old";
ALTER TYPE "OrderArea_new" RENAME TO "OrderArea";
DROP TYPE "public"."OrderArea_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "OrderStatus_new" AS ENUM ('PENDIENTE', 'EN_COCINA', 'PREPARANDO', 'LISTO', 'ENTREGADO', 'CANCELADO');
ALTER TABLE "public"."Order" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "status" TYPE "OrderStatus_new" USING ("status"::text::"OrderStatus_new");
ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";
ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";
DROP TYPE "public"."OrderStatus_old";
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'PENDIENTE';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "PurchaseStatus_new" AS ENUM ('BORRADOR', 'PENDIENTE', 'APROBADA', 'RECIBIDA', 'CANCELADA');
ALTER TABLE "public"."Purchase" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Purchase" ALTER COLUMN "status" TYPE "PurchaseStatus_new" USING ("status"::text::"PurchaseStatus_new");
ALTER TYPE "PurchaseStatus" RENAME TO "PurchaseStatus_old";
ALTER TYPE "PurchaseStatus_new" RENAME TO "PurchaseStatus";
DROP TYPE "public"."PurchaseStatus_old";
ALTER TABLE "Purchase" ALTER COLUMN "status" SET DEFAULT 'BORRADOR';
COMMIT;

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "CashMovement" ADD COLUMN     "category" TEXT,
ADD COLUMN     "createdById" INTEGER;

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "CleaningEvidence" ADD COLUMN     "createdById" INTEGER,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "fileName" TEXT,
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "mimeType" TEXT,
ADD COLUMN     "roomId" INTEGER,
ADD COLUMN     "size" INTEGER;

-- AlterTable
ALTER TABLE "CleaningTask" ADD COLUMN     "assignedToId" INTEGER,
ADD COLUMN     "finishedAt" TIMESTAMP(3),
ADD COLUMN     "finishedById" INTEGER,
ADD COLUMN     "startedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Consumption" ADD COLUMN     "status" "ConsumptionStatus" NOT NULL DEFAULT 'PENDIENTE';

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "createdById" INTEGER,
ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "EventSpace" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "basePrice" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "paymentId" INTEGER;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "createdById" INTEGER;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "createdById" INTEGER,
ADD COLUMN     "eventId" INTEGER,
ADD COLUMN     "reference" TEXT,
ADD COLUMN     "status" "PaymentStatus" NOT NULL DEFAULT 'REGISTRADO';

-- AlterTable
ALTER TABLE "PoolEntry" ADD COLUMN     "createdById" INTEGER,
ADD COLUMN     "eventId" INTEGER,
ADD COLUMN     "status" "PoolEntryStatus" NOT NULL DEFAULT 'ACTIVO';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "area" "InventoryArea" NOT NULL DEFAULT 'RESTAURANTE',
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Purchase" ADD COLUMN     "createdById" INTEGER,
ADD COLUMN     "receivedAt" TIMESTAMP(3),
ALTER COLUMN "status" SET DEFAULT 'BORRADOR';

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "createdById" INTEGER;

-- AlterTable
ALTER TABLE "RoomType" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Stay" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "VehicleEntry" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'ACTIVO';

-- CreateTable
CREATE TABLE "PoolReport" (
    "id" SERIAL NOT NULL,
    "clientId" INTEGER,
    "type" "PoolReportType" NOT NULL,
    "description" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'MEDIA',
    "status" "ReportStatus" NOT NULL DEFAULT 'ABIERTO',
    "reportedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PoolReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventContract" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "contractDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "terms" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVO',

    CONSTRAINT "EventContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CleaningReport" (
    "id" SERIAL NOT NULL,
    "roomId" INTEGER NOT NULL,
    "cleaningTaskId" INTEGER,
    "type" "CleaningReportType" NOT NULL,
    "description" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'MEDIA',
    "status" "ReportStatus" NOT NULL DEFAULT 'ABIERTO',
    "reportedById" INTEGER,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CleaningReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PoolReport_status_idx" ON "PoolReport"("status");

-- CreateIndex
CREATE UNIQUE INDEX "EventContract_eventId_key" ON "EventContract"("eventId");

-- CreateIndex
CREATE INDEX "CleaningReport_status_idx" ON "CleaningReport"("status");

-- CreateIndex
CREATE INDEX "Client_documentNumber_idx" ON "Client"("documentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_paymentId_key" ON "Invoice"("paymentId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Product_area_idx" ON "Product"("area");

-- CreateIndex
CREATE INDEX "Room_number_idx" ON "Room"("number");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "Stay"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoolEntry" ADD CONSTRAINT "PoolEntry_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoolEntry" ADD CONSTRAINT "PoolEntry_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoolReport" ADD CONSTRAINT "PoolReport_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoolReport" ADD CONSTRAINT "PoolReport_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventContract" ADD CONSTRAINT "EventContract_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CleaningTask" ADD CONSTRAINT "CleaningTask_finishedById_fkey" FOREIGN KEY ("finishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CleaningEvidence" ADD CONSTRAINT "CleaningEvidence_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CleaningEvidence" ADD CONSTRAINT "CleaningEvidence_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CleaningReport" ADD CONSTRAINT "CleaningReport_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CleaningReport" ADD CONSTRAINT "CleaningReport_cleaningTaskId_fkey" FOREIGN KEY ("cleaningTaskId") REFERENCES "CleaningTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CleaningReport" ADD CONSTRAINT "CleaningReport_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

