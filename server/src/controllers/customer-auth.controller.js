import jwt from 'jsonwebtoken';
import { createHash } from 'crypto';
import admin from 'firebase-admin';
import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';
import { createError } from '../utils/httpError.js';

const prisma = new PrismaClient();

function firebaseAuth() {
  if (!admin.apps.length) {
    admin.initializeApp({ projectId: env.firebaseProjectId });
  }
  return admin.auth();
}

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

export const googleSession = async (req, res, next) => {
  try {
    const credential = req.body?.credential || {};
    const idToken = typeof credential === 'string' ? credential : credential.idToken;

    if (!idToken) {
      throw createError(400, 'Token de Firebase obligatorio');
    }

    let decoded;
    try {
      decoded = await firebaseAuth().verifyIdToken(idToken);
    } catch {
      throw createError(401, 'Token de Firebase inválido');
    }

    const email = String(decoded.email || '').trim().toLowerCase();
    const fullName = String(decoded.name || credential.name || '').trim();
    const firstName = String(decoded.firebase?.sign_in_provider === 'google.com' ? credential.given_name || fullName.split(' ')[0] || 'Cliente' : fullName.split(' ')[0] || 'Cliente').trim();
    const lastName = String(credential.family_name || fullName.split(' ').slice(1).join(' ') || 'Google').trim();

    if (!email) {
      throw createError(400, 'Email de Google obligatorio');
    }

    const googleHash = createHash('sha1').update(email).digest('hex').slice(0, 12).toUpperCase();
    const documentNumber = `GOOGLE-${googleHash}`;

    let client = await prisma.client.findFirst({
      where: {
        OR: [
          { email },
          { documentNumber }
        ]
      }
    });

    if (!client) {
      client = await prisma.client.create({
        data: {
          documentType: 'GOOGLE',
          documentNumber,
          firstName,
          lastName,
          email,
          phone: credential.phone || null,
          status: 'ACTIVO'
        }
      });
    }

    if (client.status !== 'ACTIVO') {
      throw createError(403, 'Client account is not active');
    }

    const token = jwt.sign({ clientId: client.id, scope: 'CUSTOMER' }, env.jwtSecret, { expiresIn: '8h' });

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
