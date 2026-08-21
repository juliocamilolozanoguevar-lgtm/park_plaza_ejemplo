import { prisma } from "../config/prisma.js";
import { notFound } from "../utils/httpError.js";

const includeRequest = {
  items: { include: { product: { include: { category: true } } } }
};

function normalizeItems(items = []) {
  return items
    .filter((item) => item.productId && Number(item.quantity) > 0)
    .map((item) => ({
      productId: Number(item.productId),
      quantity: Number(item.quantity),
      unit: item.unit
    }));
}

export function listSupplyRequests(query = {}) {
  return prisma.supplyRequest.findMany({
    where: {
      area: query.area || undefined,
      status: query.status || undefined
    },
    include: includeRequest,
    orderBy: { createdAt: "desc" }
  });
}

export function createSupplyRequest(data, userRole) {
  const area = data.area || (userRole === "BARTENDER" ? "BARTENDER" : userRole === "RESTAURANTE" ? "RESTAURANTE" : null);
  return prisma.supplyRequest.create({
    data: {
      area,
      notes: data.notes || null,
      items: { create: normalizeItems(data.items) }
    },
    include: includeRequest
  });
}

export async function updateSupplyRequestStatus(id, status) {
  const request = await prisma.supplyRequest.findUnique({ where: { id } });
  if (!request) throw notFound("Solicitud no encontrada.");
  return prisma.supplyRequest.update({
    where: { id },
    data: { status },
    include: includeRequest
  });
}
