import * as service from "../services/attendance.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { audit } from "../utils/audit.js";

export const summary = asyncHandler(async (req, res) => res.json(await service.summary()));
export const today = asyncHandler(async (req, res) => res.json(await service.today(req.query)));
export const history = asyncHandler(async (req, res) => res.json(await service.history(req.query)));
export const detail = asyncHandler(async (req, res) => res.json(await service.getRecord(Number(req.params.id))));
export const mark = asyncHandler(async (req, res) => {
  const result = await service.mark(req.body.identifier);
  res.status(result.type === "ENTRADA" ? 201 : 200).json(result);
});
export const correct = asyncHandler(async (req, res) => {
  const result = await service.correct(Number(req.params.id), req.body, req.user?.id);
  await audit(req, "ASISTENCIA", "CORREGIR", `Registro ${req.params.id}: ${req.body.reason}`);
  res.json(result.current);
});
