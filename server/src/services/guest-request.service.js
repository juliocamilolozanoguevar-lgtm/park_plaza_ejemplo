import { PrismaClient } from '@prisma/client';
import { createError } from '../utils/httpError.js';
import { emitToStay } from '../socket.js';

const prisma = new PrismaClient();

export const createGuestRequest = async (clientId, stayId, roomId, data) => {
  const { type, description, priority } = data;

  const validTypes = ['TOALLAS', 'ALMOHADAS', 'LIMPIEZA', 'MANTENIMIENTO', 'ROOM_SERVICE', 'OTRO'];
  const validPriorities = ['BAJA', 'NORMAL', 'ALTA', 'URGENTE'];

  if (!validTypes.includes(type)) {
    throw createError(400, `Invalid type. Allowed: ${validTypes.join(', ')}`);
  }
  if (priority && !validPriorities.includes(priority)) {
    throw createError(400, `Invalid priority. Allowed: ${validPriorities.join(', ')}`);
  }

  // Ejecutamos en transacción para asegurar consistencia
  const guestRequest = await prisma.$transaction(async (tx) => {
    return tx.guestRequest.create({
      data: {
        clientId,
        stayId,
        roomId,
        type,
        description,
        priority: priority || 'NORMAL',
        status: 'PENDIENTE'
      }
    });
  });

  // Evento socket DESPUÉS del commit (fuera de la transacción)
  try {
    emitToStay(stayId, 'guest-request:created', guestRequest);
  } catch (e) {
    console.error('Socket emission failed for guest-request:created', e);
  }

  return guestRequest;
};

export const getGuestRequests = async (stayId) => {
  return prisma.guestRequest.findMany({
    where: { stayId },
    orderBy: { createdAt: 'desc' }
  });
};

export const getGuestRequestById = async (id, stayId) => {
  const request = await prisma.guestRequest.findFirst({
    where: { id: parseInt(id), stayId }
  });

  if (!request) {
    throw createError(404, 'Guest request not found or not owned by current stay');
  }

  return request;
};

export const cancelGuestRequest = async (id, stayId) => {
  const existing = await prisma.guestRequest.findFirst({
    where: { id: parseInt(id), stayId }
  });

  if (!existing) {
    throw createError(404, 'Guest request not found or not owned by current stay');
  }

  if (existing.status !== 'PENDIENTE') {
    throw createError(400, 'Only pending requests can be cancelled');
  }

  const cancelled = await prisma.$transaction(async (tx) => {
    return tx.guestRequest.update({
      where: { id: parseInt(id) },
      data: { status: 'CANCELADA' }
    });
  });

  try {
    emitToStay(stayId, 'guest-request:updated', cancelled);
  } catch (e) {
    console.error('Socket emission failed for guest-request:updated', e);
  }

  return cancelled;
};
