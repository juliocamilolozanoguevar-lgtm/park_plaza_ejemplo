import { prisma } from "../config/prisma.js";
import { notFound } from "../utils/httpError.js";

// Limpia la hora usando partes exactas en America/Lima para representación UTC
export const getLimaStartOfDayUTC = (date = new Date()) => {
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = formatter.formatToParts(date);
  const y = parts.find(p => p.type === 'year').value;
  const m = parts.find(p => p.type === 'month').value;
  const d = parts.find(p => p.type === 'day').value;
  return new Date(`${y}-${m}-${d}T00:00:00.000Z`);
};

// 7 días para considerar un lote "por vencer"
const DAYS_TO_EXPIRE = 7;

export const calculateLotStatus = (expiresAt) => {
  if (!expiresAt) return "SIN_VENCIMIENTO";

  const today = getLimaStartOfDayUTC();
  const expDate = getLimaStartOfDayUTC(expiresAt);

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

export async function getAvailableLotsForProduct(productId, db = prisma) {
  const today = getLimaStartOfDayUTC();

  // Find all lots that are active, have qty > 0, and are not expired
  const lots = await db.inventoryLot.findMany({
    where: {
      productId: Number(productId),
      active: true,
      currentQty: { gt: 0 },
      OR: [
        { expiresAt: null },
        { expiresAt: { gte: today } }
      ]
    }
  });

  // Sort them in memory to guarantee NULLS LAST and correct order regardless of DB dialect specifics.
  return lots.sort((a, b) => {
    // 1. expiresAt ASC (Nulls last)
    if (a.expiresAt && !b.expiresAt) return -1;
    if (!a.expiresAt && b.expiresAt) return 1;
    if (a.expiresAt && b.expiresAt) {
      if (a.expiresAt.getTime() !== b.expiresAt.getTime()) {
        return a.expiresAt.getTime() - b.expiresAt.getTime();
      }
    }
    // 2. receivedAt ASC
    if (a.receivedAt.getTime() !== b.receivedAt.getTime()) {
      return a.receivedAt.getTime() - b.receivedAt.getTime();
    }
    // 3. id ASC
    return a.id - b.id;
  });
}

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
