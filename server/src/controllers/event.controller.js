import * as service from "../services/event.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { audit } from "../utils/audit.js";

export const index = asyncHandler(async (req, res) => {
  const events = await service.listEvents(req.query);
  res.json(events.map((event) => ({ ...event, code: `EVT-${new Date(event.startsAt).getFullYear()}-${String(event.id).padStart(4, "0")}` })));
});

export const spaces = asyncHandler(async (req, res) => {
  res.json(await service.listEventSpaces());
});

export const show = asyncHandler(async (req, res) => {
  const event = await service.getEvent(Number(req.params.id));
  res.json({ ...event, code: `EVT-${new Date(event.startsAt).getFullYear()}-${String(event.id).padStart(4, "0")}` });
});

export const store = asyncHandler(async (req, res) => {
  const event = await service.createEvent(req.body, req.user?.id);
  await audit(req, "EVENTOS", "CREAR", event.name);
  res.status(201).json(event);
});

export const update = asyncHandler(async (req, res) => {
  const event = await service.updateEvent(Number(req.params.id), req.body);
  await audit(req, "EVENTOS", "EDITAR", event.name);
  res.json(event);
});

export const status = asyncHandler(async (req, res) => {
  const event = await service.updateEventStatus(Number(req.params.id), req.body.status);
  await audit(req, "EVENTOS", "CAMBIAR_ESTADO", `${event.name} -> ${event.status}`);
  res.json(event);
});

export const payment = asyncHandler(async (req, res) => {
  const event = await service.registerEventPayment(Number(req.params.id), req.body, req.user?.id);
  await audit(req, "EVENTOS", "PAGO", event.name);
  res.status(201).json(event);
});
