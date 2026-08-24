import { prisma } from "../config/prisma.js";
import { HttpError, notFound } from "../utils/httpError.js";
import { buildOrderRecipePlan, consumeOrderReservation, releaseOrderReservation, reserveOrderStock } from "./recipe.service.js";
import { emitToStay } from "../socket.js";

const includeOrder = {
  items: { include: { product: { include: { category: true } } } },
  stay: { include: { client: true, room: true } },
  stockReservation: { include: { items: { include: { product: true } } } }
};

async function attachRecipePlan(order, db = prisma) {
  const recipePlan = await buildOrderRecipePlan(order, db);
  return { ...order, recipePlan };
}

export async function listOrders(query = {}, defaultArea) {
  const orders = await prisma.order.findMany({
    where: {
      area: query.area || defaultArea || undefined,
      status: query.status || undefined
    },
    include: includeOrder,
    orderBy: { createdAt: "desc" }
  });
  return Promise.all(orders.map(attachRecipePlan));
}

export async function getOrder(id) {
  const order = await prisma.order.findUnique({ where: { id }, include: includeOrder });
  if (!order) throw notFound("Pedido no encontrado.");
  return attachRecipePlan(order);
}

export async function updateOrderStatus(id, status, userId) {
  if (!["PENDIENTE", "EN_COCINA", "PREPARANDO", "LISTO", "ENTREGADO", "CANCELADO"].includes(status)) {
    throw new HttpError(422, "Estado de pedido invalido.");
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: includeOrder
  });
  if (!order) throw notFound("Pedido no encontrado.");

  let attempts = 0;
  const maxAttempts = 10;
  while (attempts < maxAttempts) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        if (status === "PREPARANDO" && order.status !== "PREPARANDO") {
          await reserveOrderStock(id, userId, tx);
        }

        if (status === "LISTO" && order.status !== "LISTO") {
          await consumeOrderReservation(id, order.code, userId, tx);
        }

        if (status === "CANCELADO" && !["LISTO", "ENTREGADO"].includes(order.status)) {
          await releaseOrderReservation(id, tx);
        }

        const updated = await tx.order.update({
          where: { id },
          data: { status },
          include: includeOrder
        });

        if (status === "ENTREGADO" && order.status !== "ENTREGADO") {
          await tx.consumption.upsert({
            where: { orderId: id },
            update: { status: "PENDIENTE", amount: order.total },
            create: {
              clientId: order.clientId,
              stayId: order.stayId,
              orderId: id,
              area: order.area,
              concept: `Pedido ${order.code}`,
              amount: order.total,
              status: "PENDIENTE"
            }
          });
        }

        return attachRecipePlan(updated, tx);
      }, { isolationLevel: (await import('@prisma/client')).Prisma.TransactionIsolationLevel.Serializable });
      
      if (result.stayId) {
        emitToStay(result.stayId, "order:status_updated", {
          orderId: result.id,
          code: result.code,
          status: result.status,
          area: result.area,
          updatedAt: result.updatedAt
        });
      }
      
      return result;
    } catch (e) {
      if (e.code === "P2034" || (e.message && e.message.includes("40001"))) {
        attempts++;
        if (attempts >= maxAttempts) throw new HttpError(409, "Conflicto de concurrencia al actualizar pedido. Intente nuevamente.");
        await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 50) * attempts));
        continue;
      }
      throw e;
    }
  }
}
