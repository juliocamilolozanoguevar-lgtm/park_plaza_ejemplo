import { prisma } from "../config/prisma.js";
import { notFound } from "../utils/httpError.js";

export function listPoolEntries(query = {}) {
  return prisma.poolEntry.findMany({
    where: {
      status: query.status || undefined,
      type: query.type || undefined
    },
    include: { client: true, reservation: true, event: true },
    orderBy: { entryAt: "desc" }
  });
}

export function searchPoolClients(q = "") {
  const search = q.trim();
  if (!search) return [];
  return prisma.client.findMany({
    where: {
      status: { not: "INACTIVO" },
      OR: [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { documentNumber: { contains: search } }
      ]
    },
    take: 8,
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }]
  });
}

export function createPoolEntry(data) {
  return prisma.poolEntry.create({
    data: {
      clientId: data.clientId ? Number(data.clientId) : null,
      type: data.type,
      people: Number(data.people || 1),
      qrCode: `POOL-${Date.now()}`
    },
    include: { client: true }
  });
}

export async function finishPoolEntry(id) {
  const entry = await prisma.poolEntry.findUnique({ where: { id } });
  if (!entry) throw notFound("Ingreso a piscina no encontrado.");
  return prisma.poolEntry.update({
    where: { id },
    data: { status: "FINALIZADO", exitAt: new Date() },
    include: { client: true }
  });
}

export function listPoolReports() {
  return prisma.poolReport.findMany({
    include: { client: true, reportedBy: true },
    orderBy: { createdAt: "desc" }
  });
}

export function createPoolReport(data, userId) {
  return prisma.poolReport.create({
    data: {
      clientId: data.clientId ? Number(data.clientId) : null,
      type: data.type,
      description: data.description,
      priority: data.priority || "MEDIA",
      reportedById: userId
    },
    include: { client: true }
  });
}
