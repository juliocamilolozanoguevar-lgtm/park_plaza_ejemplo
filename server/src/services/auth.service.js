import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
import { HttpError } from "../utils/httpError.js";

export async function login(email, password) {
  const user = await prisma.user.findUnique({
    where: { email },
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
    throw new HttpError(401, "Credenciales invalidas.");
  }

  const passwordOk = await bcrypt.compare(password, user.passwordHash);
  if (!passwordOk) {
    throw new HttpError(401, "Credenciales invalidas.");
  }

  const permissions = user.role.permissions.map((item) => ({
    module: item.permission.module,
    action: item.permission.action
  }));

  const token = jwt.sign(
    { id: user.id, role: user.role.name },
    env.jwtSecret,
    { expiresIn: "8h" }
  );

  return {
    token,
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role.name,
      permissions
    }
  };
}
