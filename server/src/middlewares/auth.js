import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { HttpError } from "../utils/httpError.js";

export async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      throw new HttpError(401, "Token requerido.");
    }

    const payload = jwt.verify(token, env.jwtSecret);
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true }
            }
          }
        }
      }
    });

    if (!user || user.status !== "ACTIVO") {
      throw new HttpError(401, "Usuario no autorizado.");
    }

    req.user = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role.name,
      permissions: user.role.permissions.map((item) => `${item.permission.module}:${item.permission.action}`)
    };

    next();
  } catch (error) {
    next(error.status ? error : new HttpError(401, "Token invalido o expirado."));
  }
}

export function authorize(...requiredPermissions) {
  return (req, res, next) => {
    if (req.user?.role === "ADMINISTRADOR") {
      return next();
    }

    const allowed = requiredPermissions.some((permission) => req.user?.permissions.includes(permission));
    if (!allowed) {
      return next(new HttpError(403, "No tienes permisos para acceder a este modulo."));
    }

    next();
  };
}
