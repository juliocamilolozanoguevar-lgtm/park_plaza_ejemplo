import * as service from "../services/order.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { audit } from "../utils/audit.js";

export function index(defaultArea) {
  return asyncHandler(async (req, res) => {
    res.json(await service.listOrders(req.query, defaultArea));
  });
}

export const show = asyncHandler(async (req, res) => {
  res.json(await service.getOrder(Number(req.params.id)));
});

export const updateStatus = asyncHandler(async (req, res) => {
  const order = await service.updateOrderStatus(Number(req.params.id), req.body.status, req.user?.id);
  await audit(req, "PEDIDOS", "CAMBIAR_ESTADO", `${order.code} -> ${order.status}`);
  res.json(order);
});
