import { asyncHandler } from "../utils/asyncHandler.js";
import {
  createServiceReservation,
  getClientServiceReservations,
  getClientServiceReservationById,
  cancelServiceReservation,
  payServiceReservation,
  checkInServiceReservation,
  completeServiceReservation,
} from "../services/service-reservation.service.js";
import { createCustomerOrder, getClientMenu, getCustomerOrders } from "../services/client-portal.service.js";

// ============================================================
// Staff routes (existentes — no modificadas)
// ============================================================

export const checkInMirador = asyncHandler(async (req, res) => {
  const data = await checkInServiceReservation(req.params.id, req.user, "MIRADOR", req.body?.qrCode);
  res.json(data);
});

export const completeMirador = asyncHandler(async (req, res) => {
  const data = await completeServiceReservation(req.params.id, "MIRADOR");
  res.json(data);
});

// ============================================================
// Customer B2C routes
// clientId proviene EXCLUSIVAMENTE de req.client (JWT CUSTOMER)
// Nunca del body, query o params
// ============================================================

export const createReservation = asyncHandler(async (req, res) => {
  const { clientId } = req.client;
  const data = await createServiceReservation(clientId, null, null, req.body);
  res.status(201).json({ success: true, data });
});

export const listReservations = asyncHandler(async (req, res) => {
  const { clientId } = req.client;
  const data = await getClientServiceReservations(clientId, null);
  res.json({ success: true, data });
});

export const getReservationDetails = asyncHandler(async (req, res) => {
  const { clientId } = req.client;
  const data = await getClientServiceReservationById(clientId, null, req.params.id);
  res.json({ success: true, data });
});

export const cancelReservation = asyncHandler(async (req, res) => {
  const { clientId } = req.client;
  const data = await cancelServiceReservation(clientId, null, req.params.id);
  res.json({ success: true, data });
});

export const addPayment = asyncHandler(async (req, res) => {
  const { clientId } = req.client;
  const data = await payServiceReservation(clientId, null, req.params.id, req.body);
  res.json({ success: true, data });
});

export const menu = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await getClientMenu(req.params.area.toUpperCase()) });
});

export const createOrder = asyncHandler(async (req, res) => {
  const { clientId } = req.client;
  const data = await createCustomerOrder(clientId, req.body);
  res.status(201).json({ success: true, data });
});

export const listOrders = asyncHandler(async (req, res) => {
  const { clientId } = req.client;
  res.json({ success: true, data: await getCustomerOrders(clientId) });
});
