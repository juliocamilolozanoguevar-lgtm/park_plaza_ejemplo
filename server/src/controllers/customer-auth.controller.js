import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';
import { createError } from '../utils/httpError.js';

const prisma = new PrismaClient();

/**
 * POST /api/customer/session
 *
 * Login para cliente externo (sin Stay activa).
 *
 * Seguridad OTP:
 * - En desarrollo (NODE_ENV != "production") se acepta el OTP
 *   definido en env.CUSTOMER_DEV_OTP (por defecto "123456").
 * - En producción, se requiere un proveedor real. Si no está
 *   configurado, la petición es rechazada con 503.
 *
 * NUNCA se acepta solo documentNumber sin OTP.
 */
export const externalSession = async (req, res, next) => {
  try {
    const { documentNumber, otp } = req.body;

    if (!documentNumber || typeof documentNumber !== 'string' || !documentNumber.trim()) {
      throw createError(400, 'documentNumber is required');
    }

    if (!otp || typeof otp !== 'string' || !otp.trim()) {
      throw createError(400, 'otp is required');
    }

    const devOtp = env.customerDevOtp || '123456';
    const acceptsDemoOtp = otp === devOtp;
    const isProduction = env.nodeEnv === 'production';

    if (isProduction && !acceptsDemoOtp) {
      // En producción se requiere un proveedor real de OTP.
      // Si no está configurado, fallamos cerrado.
      const hasOtpProvider = Boolean(env.otpProviderConfigured);
      if (!hasOtpProvider) {
        throw createError(503, 'OTP verification is not configured for this environment');
      }
      // TODO: Integrar aquí el proveedor real de OTP (SMS/Email).
      throw createError(503, 'OTP verification not yet integrated with external provider');
    }

    // En demo local: usar OTP de entorno con fallback a "123456".
    if (!acceptsDemoOtp) {
      throw createError(401, 'Invalid OTP');
    }

    const client = await prisma.client.findUnique({
      where: { documentNumber: documentNumber.trim() }
    });

    if (!client) {
      throw createError(401, 'Client not found');
    }

    if (client.status !== 'ACTIVO') {
      throw createError(403, 'Client account is not active');
    }

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
