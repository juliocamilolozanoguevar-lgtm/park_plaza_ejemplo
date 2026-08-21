import { prisma } from "../config/prisma.js";
import { notFound } from "../utils/httpError.js";

// Limpia la hora de una fecha para comparar solo D-M-Y
const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

// 7 días para considerar un lote "por vencer"
const DAYS_TO_EXPIRE = 7;

export const calculateLotStatus = (expiresAt) => {
  if (!expiresAt) return "SIN_VENCIMIENTO";

  const today = startOfDay(new Date());
  const expDate = startOfDay(new Date(expiresAt));

  if (expDate < today) {
    return "VENCIDO";
  }

  const diffTime = Math.abs(expDate - today);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays <= DAYS_TO_EXPIRE) {
    return "POR_VENCER";
  }

  return "VIGENTE";
};

const mapLot = (lot) => ({
  ...lot,
  status: calculateLotStatus(lot.expiresAt)
});

export async function listLots(filters = {}) {
  const { area, status, search, productId } = filters;

  const where = { active: true };

  if (productId) {
    where.productId = Number(productId);
  }

  if (area) {
    where.product = { area };
  }

  if (search) {
    where.OR = [
      { code: { contains: search, mode: "insensitive" } },
      { product: { name: { contains: search, mode: "insensitive" } } }
    ];
  }

  const lots = await prisma.inventoryLot.findMany({
    where,
    include: { product: { include: { category: true } } },
    orderBy: [{ expiresAt: "asc" }, { createdAt: "desc" }]
  });

  const mapped = lots.map(mapLot);

  if (status) {
    return mapped.filter(l => l.status === status);
  }

  return mapped;
}

export async function getLot(id) {
  const lot = await prisma.inventoryLot.findUnique({
    where: { id: Number(id) },
    include: { product: true }
  });
  if (!lot) throw notFound("Lote no encontrado.");
  return mapLot(lot);
}
