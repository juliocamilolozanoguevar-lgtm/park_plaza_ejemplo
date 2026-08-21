CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENTE', 'FINALIZADA', 'REQUIERE_REVISION');

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

CREATE INDEX "AttendanceRecord_userId_checkInAt_idx" ON "AttendanceRecord"("userId", "checkInAt");
CREATE INDEX "AttendanceRecord_status_idx" ON "AttendanceRecord"("status");

ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_correctedById_fkey" FOREIGN KEY ("correctedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
