import * as service from "../services/client-portal.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const login = asyncHandler(async (req, res) => {
  const { reservationCode, documentNumber } = req.body;
  const data = await service.loginClient(reservationCode, documentNumber);
  res.json(data);
});

export const profile = asyncHandler(async (req, res) => {
  const data = await service.getClientProfile(req.client.id, req.client.stayId);
  res.json(data);
});

export const menu = asyncHandler(async (req, res) => {
  const data = await service.getClientMenu(req.params.area.toUpperCase());
  res.json(data);
});

import { 
  createServiceReservation as svcCreateSR,
  getClientServiceReservations as svcGetSRs,
  getClientServiceReservationById as svcGetSRById,
  cancelServiceReservation as svcCancelSR,
  payServiceReservation as svcPaySR
} from "../services/service-reservation.service.js";

export const createServiceReservation = asyncHandler(async (req, res) => {
  const data = await svcCreateSR(
    req.client.id,
    req.client.stayId,
    req.client.reservationId,
    req.body
  );
  res.status(201).json(data);
});

export const listServiceReservations = asyncHandler(async (req, res) => {
  const data = await svcGetSRs(req.client.id, req.client.stayId);
  res.json(data);
});

export const getServiceReservationById = asyncHandler(async (req, res) => {
  const data = await svcGetSRById(req.client.id, req.client.stayId, req.params.id);
  res.json(data);
});

export const cancelServiceReservation = asyncHandler(async (req, res) => {
  const data = await svcCancelSR(req.client.id, req.client.stayId, req.params.id);
  res.json(data);
});

export const payServiceReservation = asyncHandler(async (req, res) => {
  const data = await svcPaySR(req.client.id, req.client.stayId, req.params.id, req.body);
  res.status(201).json(data);
});

export const createOrder = asyncHandler(async (req, res) => {
  const data = await service.createClientOrder(
    req.client.id,
    req.client.stayId,
    req.client.roomId,
    req.body
  );
  res.status(201).json(data);
});

export const listOrders = asyncHandler(async (req, res) => {
  const data = await service.getClientOrders(req.client.stayId);
  res.json(data);
});

export const getOrderById = asyncHandler(async (req, res) => {
  const data = await service.getClientOrderById(req.client.id, req.client.stayId, Number(req.params.id));
  res.json(data);
});

export const listConsumptions = asyncHandler(async (req, res) => {
  const data = await service.getClientConsumptions(req.client.stayId);
  res.json(data);
});

export const listEventSpaces = asyncHandler(async (req, res) => {
  const data = await service.getEventSpaces();
  res.json(data);
});

export const listEvents = asyncHandler(async (req, res) => {
  const data = await service.getClientEvents(req.client.id);
  res.json(data);
});

export const getEventById = asyncHandler(async (req, res) => {
  const data = await service.getClientEventById(req.client.id, Number(req.params.id));
  res.json(data);
});

export const createEvent = asyncHandler(async (req, res) => {
  const data = await service.requestEvent(req.client.id, req.body);
  res.status(201).json(data);
});

export const createPoolAccess = asyncHandler(async (req, res) => {
  const data = await service.requestPoolAccess(req.client.id, req.client.stayId, req.body);
  res.status(201).json(data);
});
