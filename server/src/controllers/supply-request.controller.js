import * as service from "../services/supply-request.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { audit } from "../utils/audit.js";

export const index = asyncHandler(async (req, res) => {
  res.json(await service.listSupplyRequests(req.query));
});

export const store = asyncHandler(async (req, res) => {
  const request = await service.createSupplyRequest(req.body, req.user?.role);
  await audit(req, "SOLICITUDES_INSUMOS", "CREAR", `${request.area} #${request.id}`);
  res.status(201).json(request);
});

export const status = asyncHandler(async (req, res) => {
  const request = await service.updateSupplyRequestStatus(Number(req.params.id), req.body.status);
  await audit(req, "SOLICITUDES_INSUMOS", "CAMBIAR_ESTADO", `${request.area} #${request.id} -> ${request.status}`);
  res.json(request);
});
