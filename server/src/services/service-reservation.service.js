import { prisma } from "../config/prisma.js";
import { HttpError, notFound } from "../utils/httpError.js";
import { randomUUID } from "node:crypto";

export function formatServiceReservationDTO(res) {
  return {
    id: res.id,
    code: res.code,
    serviceType: res.serviceType,
    status: res.status,
    date: res.date,
    slot: res.slot ? formatServiceSlotDTO(res.slot) : null,
    adults: res.adults,
    children: res.children,
    people: res.people,
    plan: res.plan ? formatServicePlanDTO(res.plan) : null,
    extras: res.extras ? res.extras.map(e => ({
      name: e.serviceExtra.name,
      quantity: e.quantity,
      unitPrice: Number(e.unitPrice),
      subtotal: Number(e.subtotal)
    })) : [],
    baseAmount: Number(res.baseAmount),
    extrasAmount: Number(res.extrasAmount),
    totalAmount: Number(res.totalAmount),
    advance: Number(res.advance),
    balance: Number(res.balance),
    qrCode: res.qrCode,
    notes: res.notes,
    createdAt: res.createdAt
  };
}

export function formatServiceSlotDTO(slot) {
  return {
    id: slot.id,
    startTime: slot.startTime,
    endTime: slot.endTime,
    capacity: slot.capacity,
    available: slot.available !== undefined ? slot.available : true,
    remaining: slot.remaining
  };
}

export function formatServicePlanDTO(plan) {
  return {
    id: plan.id,
    code: plan.code,
    name: plan.name,
    price: Number(plan.price),
    pricingMode: plan.pricingMode,
    description: plan.description
  };
}

export function formatServiceExtraDTO(extra) {
  return {
    id: extra.id,
    name: extra.name,
    price: Number(extra.price),
    description: extra.description
  };
}

export async function getPublicServices() {
  return [
    { code: "PISCINA", name: "Piscina", active: true },
    { code: "MIRADOR", name: "Mirador", active: true }
  ];
}

export async function getServiceAvailability(type, dateStr) {
  if (!["PISCINA", "MIRADOR"].includes(type)) {
    throw new HttpError(422, "Servicio no válido");
  }
  
  const targetDate = new Date(dateStr);
  if (isNaN(targetDate.getTime())) {
    throw new HttpError(422, "Fecha inválida");
  }

  const slots = await prisma.serviceSlot.findMany({
    where: { serviceType: type, active: true },
    orderBy: { startTime: 'asc' }
  });

  const reservations = await prisma.serviceReservation.findMany({
    where: {
      serviceType: type,
      date: targetDate,
      status: { in: ["PENDIENTE", "CONFIRMADA", "EN_USO"] }
    }
  });

  const slotsWithAvailability = slots.map(slot => {
    const used = reservations
      .filter(r => r.slotId === slot.id)
      .reduce((acc, r) => acc + r.people, 0);
      
    const remaining = slot.capacity - used;
    
    return {
      ...formatServiceSlotDTO(slot),
      remaining: Math.max(0, remaining),
      available: remaining > 0
    };
  });

  return [
    {
      date: dateStr,
      slots: slotsWithAvailability
    }
  ];
}

export async function getServicePlans(type) {
  const plans = await prisma.servicePlan.findMany({
    where: { serviceType: type, active: true },
    orderBy: { name: 'asc' }
  });
  return plans.map(formatServicePlanDTO);
}

export async function getServiceExtras(type) {
  const extras = await prisma.serviceExtra.findMany({
    where: { serviceType: type, active: true },
    orderBy: { name: 'asc' }
  });
  return extras.map(formatServiceExtraDTO);
}

export async function createServiceReservation(clientId, stayId, reservationId, data) {
  const adults = Number(data.adults) || 0;
  const children = Number(data.children) || 0;
  const people = adults + children;
  
  if (people <= 0) throw new HttpError(400, "Debe indicar cantidad de personas");

  let retries = 3;
  while (retries > 0) {
    try {
      return await prisma.$transaction(async (tx) => {
        const slot = await tx.serviceSlot.findUnique({ where: { id: data.slotId }});
        if (!slot || slot.serviceType !== data.serviceType || !slot.active) {
          throw new HttpError(404, "Horario no válido");
        }
        
        const reservations = await tx.serviceReservation.findMany({
          where: {
            serviceType: data.serviceType,
            date: new Date(data.date),
            slotId: slot.id,
            status: { in: ["PENDIENTE", "CONFIRMADA", "EN_USO"] }
          }
        });
        
        const used = reservations.reduce((acc, r) => acc + r.people, 0);
        if (slot.capacity - used < people) {
          throw new HttpError(409, "Capacidad excedida en el horario seleccionado");
        }

        let plan = null;
        let baseAmount = 0;
        if (data.planId) {
           plan = await tx.servicePlan.findUnique({ where: { id: data.planId }});
           if (!plan) throw new HttpError(404, "Plan no encontrado");
           
           if (plan.pricingMode === "PERSONA") baseAmount = Number(plan.price) * people;
           else if (plan.pricingMode === "ADULTO") baseAmount = Number(plan.price) * adults;
           else if (plan.pricingMode === "FIJO" || plan.pricingMode === "FAMILIAR") baseAmount = Number(plan.price);
        }

        let extrasAmount = 0;
        const extrasInput = [];
        if (data.extras && data.extras.length > 0) {
           for (const ext of data.extras) {
              const e = await tx.serviceExtra.findUnique({ where: { id: ext.id }});
              if (!e) throw new HttpError(404, `Extra ${ext.id} no encontrado`);
              const subtotal = Number(e.price) * ext.quantity;
              extrasAmount += subtotal;
              extrasInput.push({
                 serviceExtraId: e.id,
                 quantity: ext.quantity,
                 unitPrice: e.price,
                 subtotal: subtotal
              });
           }
        }

        const totalAmount = baseAmount + extrasAmount;
        const code = `SR-${randomUUID().split("-")[0].toUpperCase()}`;
        const qrCode = randomUUID();

        const newRes = await tx.serviceReservation.create({
          data: {
            code,
            clientId,
            stayId,
            reservationId,
            serviceType: data.serviceType,
            date: new Date(data.date),
            slotId: slot.id,
            adults,
            children,
            people,
            planId: plan?.id,
            planCode: plan?.code,
            planName: plan?.name,
            baseAmount,
            extrasAmount,
            totalAmount,
            balance: totalAmount,
            qrCode,
            notes: data.notes,
            extras: {
              create: extrasInput
            }
          },
          include: {
            slot: true,
            plan: true,
            extras: { include: { serviceExtra: true }}
          }
        });
        
        return formatServiceReservationDTO(newRes);
      }, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (error.code === 'P2034') {
        retries--;
        if (retries === 0) throw new HttpError(409, "Conflicto de concurrencia al reservar servicio. Intente nuevamente.");
        continue;
      }
      throw error;
    }
  }
}

export async function getClientServiceReservations(clientId, stayId) {
  const reservations = await prisma.serviceReservation.findMany({
    where: { clientId, stayId },
    include: {
      slot: true,
      plan: true,
      extras: { include: { serviceExtra: true } }
    },
    orderBy: { date: 'desc' }
  });
  return reservations.map(formatServiceReservationDTO);
}

export async function getClientServiceReservationById(clientId, stayId, id) {
  const res = await prisma.serviceReservation.findFirst({
    where: { id: Number(id), clientId, stayId },
    include: {
      slot: true,
      plan: true,
      extras: { include: { serviceExtra: true } }
    }
  });
  if (!res) throw new HttpError(404, "Reserva de servicio no encontrada");
  return formatServiceReservationDTO(res);
}

export async function cancelServiceReservation(clientId, stayId, id) {
  return await prisma.$transaction(async (tx) => {
    const res = await tx.serviceReservation.findFirst({
      where: { id: Number(id), clientId, stayId }
    });
    
    if (!res) throw new HttpError(404, "Reserva de servicio no encontrada");
    if (res.status === "CANCELADA" || res.status === "FINALIZADA" || res.status === "EN_USO") {
      throw new HttpError(400, `No se puede cancelar la reserva en estado ${res.status}`);
    }
    
    const updated = await tx.serviceReservation.update({
      where: { id: res.id },
      data: {
        status: "CANCELADA",
        cancelledAt: new Date()
      },
      include: {
        slot: true,
        plan: true,
        extras: { include: { serviceExtra: true } }
      }
    });
    
    return formatServiceReservationDTO(updated);
  });
}

import { getIO } from "../socket.js";

export async function checkInServiceReservation(id, user) {
  return await prisma.$transaction(async (tx) => {
    const res = await tx.serviceReservation.findUnique({
      where: { id: Number(id) }
    });
    
    if (!res) throw new HttpError(404, "Reserva no encontrada");
    if (res.status !== "PENDIENTE" && res.status !== "CONFIRMADA") {
      throw new HttpError(400, `No se puede hacer check-in. Estado actual: ${res.status}`);
    }

    const updated = await tx.serviceReservation.update({
      where: { id: res.id },
      data: {
        status: "EN_USO",
        checkedInAt: new Date()
      },
      include: {
        slot: true,
        plan: true,
        extras: { include: { serviceExtra: true } }
      }
    });

    if (res.serviceType === "PISCINA") {
      await tx.poolEntry.create({
        data: {
          clientId: res.clientId,
          serviceReservationId: res.id,
          type: "CLIENTE_EXTERNO", // o HUESPED según si hay stayId
          people: res.people,
          status: "ACTIVO",
          createdById: user?.id
        }
      });
    }

    if (updated.stayId) {
      getIO().to(`stay_${updated.stayId}`).emit("service-reservation:updated", {
        reservationId: updated.id,
        status: updated.status
      });
    }

    return formatServiceReservationDTO(updated);
  });
}

export async function completeServiceReservation(id) {
  return await prisma.$transaction(async (tx) => {
    const res = await tx.serviceReservation.findUnique({
      where: { id: Number(id) }
    });
    
    if (!res) throw new HttpError(404, "Reserva no encontrada");
    if (res.status !== "EN_USO") {
      throw new HttpError(400, `No se puede completar. Estado actual: ${res.status}`);
    }

    const updated = await tx.serviceReservation.update({
      where: { id: res.id },
      data: {
        status: "FINALIZADA",
        completedAt: new Date()
      },
      include: {
        slot: true,
        plan: true,
        extras: { include: { serviceExtra: true } }
      }
    });

    if (res.serviceType === "PISCINA") {
      const poolEntry = await tx.poolEntry.findFirst({
        where: { serviceReservationId: res.id, status: "ACTIVO" }
      });
      if (poolEntry) {
        await tx.poolEntry.update({
          where: { id: poolEntry.id },
          data: { status: "FINALIZADO", exitAt: new Date() }
        });
      }
    }

    if (updated.stayId) {
      getIO().to(`stay_${updated.stayId}`).emit("service-reservation:updated", {
        reservationId: updated.id,
        status: updated.status
      });
    }

    return formatServiceReservationDTO(updated);
  });
}

