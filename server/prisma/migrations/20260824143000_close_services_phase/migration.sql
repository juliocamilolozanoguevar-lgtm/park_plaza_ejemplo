-- Cierre funcional Piscina + Mirador: constraints e indices de integridad.

CREATE UNIQUE INDEX IF NOT EXISTS "ServiceSlot_serviceType_startTime_endTime_key"
ON "ServiceSlot"("serviceType", "startTime", "endTime");

CREATE UNIQUE INDEX IF NOT EXISTS "ServicePlan_serviceType_code_key"
ON "ServicePlan"("serviceType", "code");

CREATE UNIQUE INDEX IF NOT EXISTS "ServiceExtra_serviceType_name_key"
ON "ServiceExtra"("serviceType", "name");

CREATE INDEX IF NOT EXISTS "ServiceReservation_serviceType_date_slotId_status_idx"
ON "ServiceReservation"("serviceType", "date", "slotId", "status");

ALTER TABLE "ServiceSlot"
ADD CONSTRAINT "ServiceSlot_capacity_positive_check"
CHECK ("capacity" > 0);

ALTER TABLE "ServiceReservation"
ADD CONSTRAINT "ServiceReservation_people_positive_check"
CHECK ("people" > 0);

ALTER TABLE "ServiceReservationExtra"
ADD CONSTRAINT "ServiceReservationExtra_quantity_positive_check"
CHECK ("quantity" > 0);
