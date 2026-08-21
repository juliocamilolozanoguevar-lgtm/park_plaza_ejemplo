ALTER TYPE "RoleName" ADD VALUE IF NOT EXISTS 'MANTENIMIENTO';

ALTER TABLE "OperationalReport"
  ADD COLUMN IF NOT EXISTS "assignedToId" INTEGER,
  ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "workDescription" TEXT,
  ADD COLUMN IF NOT EXISTS "observations" TEXT;

DO $$
BEGIN
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
END $$;

CREATE INDEX IF NOT EXISTS "OperationalReport_assignedToId_idx" ON "OperationalReport"("assignedToId");
