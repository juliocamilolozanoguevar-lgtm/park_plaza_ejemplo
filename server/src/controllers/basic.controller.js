import { prisma } from "../config/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const delegates = {
  products: "product",
  inventory: "inventoryMovement",
  purchases: "purchase",
  suppliers: "supplier",
  payments: "payment",
  invoices: "invoice",
  cash: "cashMovement",
  users: "user",
  roles: "role",
  audit: "auditLog",
  settings: "hotelSettings",
  orders: "order",
  restaurant: "order",
  bar: "order",
  pool: "poolEntry",
  events: "event",
  parking: "parkingSpace",
  cleaning: "cleaningTask"
};

export function basicIndex(resource, include = {}) {
  return asyncHandler(async (req, res) => {
    const delegate = prisma[delegates[resource]];
    const records = await delegate.findMany({ include, take: 100, orderBy: resource === "settings" ? undefined : { id: "desc" } });
    res.json(records);
  });
}
