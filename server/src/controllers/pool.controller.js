import * as service from "../services/pool.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { audit } from "../utils/audit.js";

export const index = asyncHandler(async (req, res) => {
  res.json(await service.listPoolEntries(req.query));
});

export const searchClients = asyncHandler(async (req, res) => {
  res.json(await service.searchPoolClients(req.query.q || ""));
});

export const store = asyncHandler(async (req, res) => {
  const entry = await service.createPoolEntry(req.body);
  await audit(req, "PISCINA", "REGISTRAR_INGRESO", `Ingreso ${entry.qrCode}`);
  res.status(201).json(entry);
});

export const finish = asyncHandler(async (req, res) => {
  const entry = await service.finishPoolEntry(Number(req.params.id));
  await audit(req, "PISCINA", "REGISTRAR_SALIDA", `Salida ${entry.qrCode}`);
  res.json(entry);
});

export const reports = asyncHandler(async (req, res) => {
  res.json(await service.listPoolReports());
});

export const storeReport = asyncHandler(async (req, res) => {
  const report = await service.createPoolReport(req.body, req.user?.id);
  await audit(req, "PISCINA", "REPORTE", report.description);
  res.status(201).json(report);
});

import { 
  checkInServiceReservation as checkInSR, 
  completeServiceReservation as completeSR 
} from "../services/service-reservation.service.js";

export const checkInReservation = asyncHandler(async (req, res) => {
  const data = await checkInSR(req.params.id, req.user);
  res.json(data);
});

export const completeReservation = asyncHandler(async (req, res) => {
  const data = await completeSR(req.params.id);
  res.json(data);
});
