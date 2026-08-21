import * as service from "../services/room.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { audit } from "../utils/audit.js";

export const index = asyncHandler(async (req, res) => {
  const [rooms, counters] = await Promise.all([
    service.listRooms(req.query),
    service.roomCounters()
  ]);
  res.json({ rooms, counters });
});

export const types = asyncHandler(async (req, res) => {
  res.json(await service.listRoomTypes());
});

export const show = asyncHandler(async (req, res) => {
  res.json(await service.getRoom(Number(req.params.id)));
});

export const availability = asyncHandler(async (req, res) => {
  res.json(await service.getRoomAvailability(Number(req.params.id)));
});

export const checkAvailability = asyncHandler(async (req, res) => {
  res.json(await service.checkRoomAvailability(Number(req.params.id), req.query.checkIn, req.query.checkOut));
});

export const store = asyncHandler(async (req, res) => {
  const room = await service.createRoom(req.body);
  await audit(req, "HABITACIONES", "CREAR", `Habitacion ${room.number}`);
  res.status(201).json(room);
});

export const update = asyncHandler(async (req, res) => {
  const room = await service.updateRoom(Number(req.params.id), req.body);
  await audit(req, "HABITACIONES", "EDITAR", `Habitacion ${room.number}`);
  res.json(room);
});

export const destroy = asyncHandler(async (req, res) => {
  const room = await service.deleteRoom(Number(req.params.id));
  await audit(req, "HABITACIONES", "FUERA_SERVICIO", `Habitacion ${room.number}`);
  res.json(room);
});
