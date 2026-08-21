import * as service from "../services/client.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { audit } from "../utils/audit.js";

export const index = asyncHandler(async (req, res) => {
  res.json(await service.listClients(req.query));
});

export const search = asyncHandler(async (req, res) => {
  res.json(await service.searchClients(req.query.q || ""));
});

export const show = asyncHandler(async (req, res) => {
  res.json(await service.getClient(Number(req.params.id)));
});

export const store = asyncHandler(async (req, res) => {
  const client = await service.createClient(req.body);
  await audit(req, "CLIENTES", "CREAR", `Cliente ${client.documentNumber}`);
  res.status(201).json(client);
});

export const update = asyncHandler(async (req, res) => {
  const client = await service.updateClient(Number(req.params.id), req.body);
  await audit(req, "CLIENTES", "EDITAR", `Cliente ${client.documentNumber}`);
  res.json(client);
});

export const destroy = asyncHandler(async (req, res) => {
  const client = await service.deleteClient(Number(req.params.id));
  await audit(req, "CLIENTES", "DESACTIVAR", `Cliente ${client.documentNumber}`);
  res.json(client);
});
