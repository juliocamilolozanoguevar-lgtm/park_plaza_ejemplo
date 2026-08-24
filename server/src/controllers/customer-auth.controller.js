import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';
import { createError } from '../utils/httpError.js';

const prisma = new PrismaClient();

export const externalSession = async (req, res, next) => {
  try {
    const { documentNumber, otp } = req.body;

    if (!documentNumber) {
      throw createError(400, 'documentNumber is required');
    }

    // En DEV permitimos bypass con OTP '123456' o sin OTP si se prefiere.
    // Como acordamos, usaremos '123456' para el mock de OTP.
    if (otp !== '123456') {
      throw createError(401, 'Invalid OTP');
    }

    // Buscar cliente por documento
    const client = await prisma.client.findUnique({
      where: { documentNumber }
    });

    if (!client) {
      throw createError(401, 'Client not found');
    }

    if (client.status !== 'ACTIVO') {
      throw createError(403, 'Client account is not active');
    }

    // Generar JWT exclusivo de CUSTOMER sin stayId ni roomId
    const payload = {
      clientId: client.id,
      scope: 'CUSTOMER'
    };

    const token = jwt.sign(payload, env.jwtSecret, { expiresIn: '8h' });

    res.json({
      success: true,
      data: {
        token,
        client: {
          id: client.id,
          firstName: client.firstName,
          lastName: client.lastName,
          email: client.email,
          documentNumber: client.documentNumber
        }
      }
    });
  } catch (error) {
    next(error);
  }
};
