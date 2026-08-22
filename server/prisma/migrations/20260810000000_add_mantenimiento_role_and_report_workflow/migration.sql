ALTER TYPE "RoleName" ADD VALUE IF NOT EXISTS 'MANTENIMIENTO';

DO $$ BEGIN
  CREATE TYPE "ReportStatus" AS ENUM ('ABIERTO', 'EN_REVISION', 'RESUELTO');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "InventoryArea" AS ENUM ('RESTAURANTE', 'BARTENDER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "OperationalReport" (
  "id" SERIAL NOT NULL,
  "code" TEXT NOT NULL,
  "area" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "priority" TEXT NOT NULL DEFAULT 'MEDIA',
  "status" "ReportStatus" NOT NULL DEFAULT 'ABIERTO',
  "requiresMaintenance" BOOLEAN NOT NULL DEFAULT false,
  "reportedById" INTEGER,
  "resolvedById" INTEGER,
  "roomId" INTEGER,
  "cleaningTaskId" INTEGER,
  "productId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),

  CONSTRAINT "OperationalReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OperationalReportEvidence" (
  "id" SERIAL NOT NULL,
  "reportId" INTEGER NOT NULL,
  "imageUrl" TEXT NOT NULL,
  "fileName" TEXT,
  "mimeType" TEXT,
  "size" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OperationalReportEvidence_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "OperationalReport"
  ADD COLUMN IF NOT EXISTS "assignedToId" INTEGER,
  ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "workDescription" TEXT,
  ADD COLUMN IF NOT EXISTS "observations" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "OperationalReport_code_key" ON "OperationalReport"("code");
CREATE INDEX IF NOT EXISTS "OperationalReport_area_idx" ON "OperationalReport"("area");
CREATE INDEX IF NOT EXISTS "OperationalReport_status_idx" ON "OperationalReport"("status");
CREATE INDEX IF NOT EXISTS "OperationalReport_priority_idx" ON "OperationalReport"("priority");
CREATE INDEX IF NOT EXISTS "OperationalReport_type_idx" ON "OperationalReport"("type");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'OperationalReport_reportedById_fkey'
  ) THEN
    ALTER TABLE "OperationalReport"
      ADD CONSTRAINT "OperationalReport_reportedById_fkey"
      FOREIGN KEY ("reportedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'OperationalReport_assignedToId_fkey'
  ) THEN
    ALTER TABLE "OperationalReport"
      ADD CONSTRAINT "OperationalReport_assignedToId_fkey"
      FOREIGN KEY ("assignedToId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'OperationalReport_resolvedById_fkey'
  ) THEN
    ALTER TABLE "OperationalReport"
      ADD CONSTRAINT "OperationalReport_resolvedById_fkey"
      FOREIGN KEY ("resolvedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'OperationalReport_roomId_fkey'
  ) THEN
    ALTER TABLE "OperationalReport"
      ADD CONSTRAINT "OperationalReport_roomId_fkey"
      FOREIGN KEY ("roomId") REFERENCES "Room"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'OperationalReport_cleaningTaskId_fkey'
  ) THEN
    ALTER TABLE "OperationalReport"
      ADD CONSTRAINT "OperationalReport_cleaningTaskId_fkey"
      FOREIGN KEY ("cleaningTaskId") REFERENCES "CleaningTask"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'OperationalReport_productId_fkey'
  ) THEN
    ALTER TABLE "OperationalReport"
      ADD CONSTRAINT "OperationalReport_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "Product"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'OperationalReportEvidence_reportId_fkey'
  ) THEN
    ALTER TABLE "OperationalReportEvidence"
      ADD CONSTRAINT "OperationalReportEvidence_reportId_fkey"
      FOREIGN KEY ("reportId") REFERENCES "OperationalReport"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "OperationalReport_assignedToId_idx" ON "OperationalReport"("assignedToId");
