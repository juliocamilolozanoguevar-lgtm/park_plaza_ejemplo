import { prisma } from "../config/prisma.js";
import { notFound } from "../utils/httpError.js";

export function listClients(query = {}) {
  const search = query.search?.trim();
  return prisma.client.findMany({
    where: search
      ? {
          OR: [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
            { documentNumber: { contains: search } },
            { email: { contains: search, mode: "insensitive" } }
          ]
        }
      : undefined,
    include: {
      reservations: true,
      events: { include: { space: true }, orderBy: { startsAt: "desc" } },
      payments: true,
      consumptions: true
    },
    orderBy: { createdAt: "desc" }
  });
}

export function searchClients(q = "") {
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

export async function getClient(id) {
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      reservations: { include: { room: true } },
      stays: { include: { room: true } },
      payments: true,
      consumptions: true,
      events: true,
      poolEntries: true
    }
  });
  if (!client) throw notFound("Cliente no encontrado.");
  return client;
}

export async function createClient(data) {
  const existing = await prisma.client.findFirst({
    where: {
      OR: [
        { documentNumber: String(data.documentNumber || '') },
        ...(data.email ? [{ email: String(data.email) }] : [])
      ]
    }
  });
  if (existing) return existing;

  return prisma.client.create({
    data: {
      ...data,
      email: data.email || null,
      birthDate: data.birthDate ? new Date(data.birthDate) : null
    }
  });
}

export async function updateClient(id, data) {
  await getClient(id);
  return prisma.client.update({
    where: { id },
    data: {
      ...data,
      email: data.email || null,
      birthDate: data.birthDate ? new Date(data.birthDate) : null
    }
  });
}

export async function deleteClient(id) {
  await getClient(id);
  return prisma.client.update({
    where: { id },
    data: { status: "INACTIVO" }
  });
}

