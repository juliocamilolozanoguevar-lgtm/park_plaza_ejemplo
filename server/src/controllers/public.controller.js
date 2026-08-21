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

export const createReservation = asyncHandler(async (req, res) => {
  res.status(201).json(await service.createPublicReservation(req.body));
});

export const showReservation = asyncHandler(async (req, res) => {
  res.json(await service.getPublicReservation(req.params.code, req.query.documentNumber));
});