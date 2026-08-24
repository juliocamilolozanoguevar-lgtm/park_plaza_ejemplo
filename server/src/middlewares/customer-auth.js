import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';
import { createError } from '../utils/httpError.js';

const prisma = new PrismaClient();

export const authenticateCustomer = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw createError(401, 'No token provided');
    }

    const token = authHeader.split(' ')[1];
    
    // Verify token
    const decoded = jwt.verify(token, env.jwtSecret);
    
    // Validate scope
    if (decoded.scope !== 'CUSTOMER') {
      throw createError(403, 'Invalid token scope. CUSTOMER scope required.');
    }

    if (!decoded.clientId) {
      throw createError(401, 'Invalid token payload');
    }

    // Verify client exists and is active
    const client = await prisma.client.findUnique({
      where: { id: decoded.clientId }
    });

    if (!client) {
      throw createError(401, 'Client not found');
    }

    if (client.status !== 'ACTIVO') {
      throw createError(403, 'Client account is not active');
    }

    // Inject client data into request (Note: NO stayId, NO roomId for external customer)
    req.client = {
      clientId: client.id,
      scope: 'CUSTOMER'
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      next(createError(401, 'Invalid or expired token'));
    } else {
      next(error);
    }
  }
};
