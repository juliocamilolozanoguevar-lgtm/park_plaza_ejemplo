DO $$ BEGIN
  CREATE TYPE "ReservationOrigin" AS ENUM ('WEB', 'RECEPCION', 'ADMIN');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "Reservation"
  ADD COLUMN IF NOT EXISTS "origin" "ReservationOrigin" NOT NULL DEFAULT 'RECEPCION';
