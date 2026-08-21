import * as service from "../services/production.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { audit } from "../utils/audit.js";

export const index = asyncHandler(async (req, res) => {
  res.json(await service.listProductions(req.query));
});

export const summary = asyncHandler(async (req, res) => {
  res.json(await service.productionSummary(req.query));
});

export const store = asyncHandler(async (req, res) => {
  const production = await service.createProduction(req.body, req.user?.id);
  await audit(req, "PRODUCCION", "CREAR", production.code);
  res.status(201).json(production);
});
