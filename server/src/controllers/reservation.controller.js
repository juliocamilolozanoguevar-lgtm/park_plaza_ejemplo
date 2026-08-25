import * as service from "../services/reservation.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { audit } from "../utils/audit.js";

export const index = asyncHandler(async (req, res) => {
  res.json(await service.listReservations(req.query));
});

export const show = asyncHandler(async (req, res) => {
  res.json(await service.getReservation(Number(req.params.id)));
});

export const store = asyncHandler(async (req, res) => {
  const reservation = await service.createReservation(req.body);
  await audit(req, "RESERVAS", "CREAR", reservation.code);
  res.status(201).json(reservation);
});

export const update = asyncHandler(async (req, res) => {
  const reservation = await service.updateReservation(Number(req.params.id), req.body);
  await audit(req, "RESERVAS", "EDITAR", reservation.code);
  res.json(reservation);
});

export const destroy = asyncHandler(async (req, res) => {
  const reservation = await service.cancelReservation(Number(req.params.id));
  await audit(req, "RESERVAS", reservation.deleted ? "ELIMINAR" : "CANCELAR", reservation.code);
  res.json(reservation);
});

export const confirmCashPayment = asyncHandler(async (req, res) => {
  const reservation = await service.confirmReservationCashPayment(Number(req.params.id), req.user?.id);
  await audit(req, "RESERVAS", "CONFIRMAR_PAGO_EFECTIVO", reservation.code);
  res.json(reservation);
});

export const confirmPayment = asyncHandler(async (req, res) => {
  const reservation = await service.confirmReservationPayment(Number(req.params.id), req.body, req.user?.id);
  await audit(req, "RESERVAS", "CONFIRMAR_PAGO", reservation.code);
  res.json(reservation);
});
