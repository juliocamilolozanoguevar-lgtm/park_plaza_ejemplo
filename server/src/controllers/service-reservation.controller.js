import { asyncHandler } from "../utils/asyncHandler.js";
import {
  checkInServiceReservation,
  completeServiceReservation,
  listServiceReservations
} from "../services/service-reservation.service.js";

export const index = asyncHandler(async (req, res) => {
  res.json(await listServiceReservations());
});

export const checkInMirador = asyncHandler(async (req, res) => {
  const data = await checkInServiceReservation(req.params.id, req.user, "MIRADOR", req.body?.qrCode);
  res.json(data);
});

export const completeMirador = asyncHandler(async (req, res) => {
  const data = await completeServiceReservation(req.params.id, "MIRADOR");
  res.json(data);
});
