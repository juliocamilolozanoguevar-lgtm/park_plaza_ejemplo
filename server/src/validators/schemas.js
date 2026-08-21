import { z } from "zod";

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(6)
  })
});

export const clientSchema = z.object({
  body: z.object({
    documentType: z.string().min(1),
    documentNumber: z.string().min(4),
    firstName: z.string().min(2),
    lastName: z.string().min(2),
    phone: z.string().optional().nullable(),
    email: z.string().email().optional().nullable().or(z.literal("")),
    address: z.string().optional().nullable(),
    birthDate: z.string().optional().nullable(),
    status: z.enum(["ACTIVO", "INACTIVO", "HOSPEDADO"]).optional()
  })
});

export const roomSchema = z.object({
  body: z.object({
    number: z.string().min(1),
    floor: z.coerce.number().int().positive(),
    typeId: z.coerce.number().int().positive(),
    price: z.coerce.number().nonnegative(),
    capacity: z.coerce.number().int().positive(),
    description: z.string().optional().nullable(),
    status: z.enum(["LIBRE", "RESERVADA", "OCUPADA", "EN_LIMPIEZA", "MANTENIMIENTO", "FUERA_SERVICIO"]).optional()
  })
});

export const reservationSchema = z.object({
  body: z.object({
    clientId: z.coerce.number().int().positive(),
    roomId: z.coerce.number().int().positive(),
    checkInDate: z.string().min(10),
    checkOutDate: z.string().min(10),
    adults: z.coerce.number().int().positive(),
    children: z.coerce.number().int().nonnegative().default(0),
    totalPrice: z.coerce.number().nonnegative(),
    advance: z.coerce.number().nonnegative().default(0),
    paymentMethod: z.enum(["EFECTIVO", "TARJETA", "YAPE", "PLIN", "TRANSFERENCIA"]).optional(),
    status: z.enum(["PENDIENTE", "CONFIRMADA", "CANCELADA", "COMPLETADA", "NO_SHOW"]).optional(),
    notes: z.string().optional().nullable()
  })
});

export const checkInSchema = z.object({
  body: z.object({
    reservationId: z.coerce.number().int().positive()
  })
});

export const checkOutSchema = z.object({
  body: z.object({
    stayId: z.coerce.number().int().positive(),
    paymentAmount: z.coerce.number().nonnegative().optional(),
    paymentMethod: z.enum(["EFECTIVO", "TARJETA", "YAPE", "PLIN", "TRANSFERENCIA"]).optional()
  })
});
