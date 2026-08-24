import * as service from "../services/public.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const hotel = asyncHandler(async (req, res) => {
  res.json(await service.getHotelInfo());
});

export const roomTypes = asyncHandler(async (req, res) => {
  res.json(await service.listPublicRoomTypes());
});

export const availableRooms = asyncHandler(async (req, res) => {
  res.json(await service.listAvailableRooms(req.query));
});

export const createClient = asyncHandler(async (req, res) => {
  res.status(201).json(await service.createPublicClient(req.body));
});

export const createReservation = asyncHandler(async (req, res) => {
  res.status(201).json(await service.createPublicReservation(req.body));
});

export const createEvent = asyncHandler(async (req, res) => {
  res.status(201).json(await service.createPublicEvent(req.body));
});

export const eventSpaces = asyncHandler(async (req, res) => {
  res.json(await service.listPublicEventSpaces());
});

export const showReservation = asyncHandler(async (req, res) => {
  res.json(await service.getPublicReservation(req.params.code, req.query.documentNumber));
});

export const recoverReservations = asyncHandler(async (req, res) => {
  res.json(await service.recoverPublicReservations(req.query.documentNumber));
});

import { 
  getPublicServices, 
  getServiceAvailability, 
  getServicePlans, 
  getServiceExtras 
} from "../services/service-reservation.service.js";

export const listServices = asyncHandler(async (req, res) => {
  res.json(await getPublicServices());
});

export const serviceAvailability = asyncHandler(async (req, res) => {
  const { date, from } = req.query;
  const type = req.params.type.toUpperCase();
  if (!date && !from) return res.status(400).json({ error: "date o from es requerido" });
  res.json(await getServiceAvailability(type, { date, from }));
});

export const servicePlans = asyncHandler(async (req, res) => {
  res.json(await getServicePlans(req.params.type.toUpperCase()));
});

export const serviceExtras = asyncHandler(async (req, res) => {
  res.json(await getServiceExtras(req.params.type.toUpperCase()));
});
