import * as service from "../services/reception.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { audit } from "../utils/audit.js";

export const searchReservations = asyncHandler(async (req, res) => {
  res.json(await service.searchReservations(req.query.search || ""));
});

export const activeStays = asyncHandler(async (req, res) => {
  res.json(await service.activeStays(req.query.search || ""));
});

export const checkIn = asyncHandler(async (req, res) => {
  const stay = await service.checkIn(req.body.reservationId);
  await audit(req, "CHECK_IN", "CREAR", `Reserva ${stay.reservation.code}`);
  res.status(201).json(stay);
});

export const checkOut = asyncHandler(async (req, res) => {
  const result = await service.checkout(req.body.stayId, req.body.paymentAmount, req.body.paymentMethod);
  await audit(req, "CHECK_OUT", "FINALIZAR", `Estadia ${req.body.stayId}`);
  res.json(result);
});
