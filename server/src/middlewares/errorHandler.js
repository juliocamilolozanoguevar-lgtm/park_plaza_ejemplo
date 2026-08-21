import { Prisma } from "@prisma/client";

export function errorHandler(error, req, res, next) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return res.status(409).json({
      message: "Ya existe un registro con esos datos unicos.",
      details: error.meta
    });
  }

  const status = error.status || 500;
  res.status(status).json({
    message: error.message || "Error interno del servidor",
    details: error.details || null
  });
}
