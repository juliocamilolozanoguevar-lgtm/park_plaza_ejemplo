import { prisma } from "../config/prisma.js";

export async function audit(req, module, action, detail) {
  await prisma.auditLog.create({
    data: {
      userId: req.user?.id,
      module,
      action,
      detail,
      ip: req.ip
    }
  });
}
