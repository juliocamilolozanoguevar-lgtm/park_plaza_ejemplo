import { prisma } from "../config/prisma.js";
import { Prisma } from "@prisma/client";
import { HttpError, notFound } from "../utils/httpError.js";

const includeProduct = { category: true };
const includeMovement = {
  product: { include: { category: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true, email: true } }
};

function statusFor(product) {
  const stock = Number(product.stock);
  const minStock = Number(product.minStock);
  if (stock === 0) return "SIN_STOCK";
  if (stock <= minStock) return "STOCK_BAJO";
  return "OK";
}

export async function listProducts(query = {}) {
  const products = await prisma.product.findMany({
    where: {
      area: query.area || undefined,
      active: true,
      categoryId: query.categoryId ? Number(query.categoryId) : undefined,
      name: query.search ? { contains: query.search, mode: "insensitive" } : undefined
    },
    include: includeProduct,
    orderBy: { name: "asc" }
  });
  return products
    .map((product) => ({ ...product, stockStatus: statusFor(product) }))
    .filter((product) => !query.status || query.status === "TODOS" || product.stockStatus === query.status);
}

export async function inventorySummary(query = {}) {
  const products = await listProducts(query);
  return {
    totalProducts: products.length,
    lowStock: products.filter((product) => product.stockStatus === "STOCK_BAJO").length,
    noStock: products.filter((product) => product.stockStatus === "SIN_STOCK").length,
    value: products.reduce((sum, product) => sum + Number(product.stock) * Number(product.cost), 0)
  };
}

export function listCategories() {
  return prisma.category.findMany({ orderBy: { name: "asc" } });
}

export function listMovements(query = {}) {
  return prisma.inventoryMovement.findMany({
    where: {
      type: query.type || undefined,
      productId: query.productId ? Number(query.productId) : undefined,
      product: { area: query.area || undefined }
    },
    include: includeMovement,
    orderBy: { createdAt: "desc" },
    take: 200
  });
}

export async function createProduct(data) {
  return prisma.product.create({
    data: {
      name: data.name,
      categoryId: Number(data.categoryId),
      area: data.area,
      unit: data.unit,
      stock: 0,
      minStock: Number(data.minStock || 0),
      cost: Number(data.cost || 0),
      price: Number(data.price || 0),
      status: data.status || "ACTIVO"
    },
    include: includeProduct
  });
}

export async function updateProduct(id, data) {
  await prisma.product.findUniqueOrThrow({ where: { id } });
  return prisma.product.update({
    where: { id },
    data: {
      name: data.name,
      categoryId: Number(data.categoryId),
      area: data.area,
      unit: data.unit,
      minStock: Number(data.minStock || 0),
      cost: Number(data.cost || 0),
      price: Number(data.price || 0),
      status: data.status || "ACTIVO"
    },
    include: includeProduct
  });
}

export async function deactivateProduct(id) {
  const history = await prisma.inventoryMovement.count({ where: { productId: id } });
  if (history === 0) {
    return prisma.product.delete({ where: { id } });
  }
  return prisma.product.update({ where: { id }, data: { active: false } });
}

export async function registerMovement(type, data, userId, txContext = null) {
  const productId = Number(data.productId);
  const quantity = new Prisma.Decimal(data.quantity || 0);
  
  if (quantity.lte(0)) throw new HttpError(422, "La cantidad debe ser mayor a cero.");

  const product = await (txContext || prisma).product.findUnique({ where: { id: productId } });
  if (!product) throw notFound("Producto no encontrado.");

  const beforeQty = new Prisma.Decimal(product.stock);
  let afterQty = beforeQty;

  if (type === "ENTRADA" || type === "ENTRADA_COMPRA") afterQty = beforeQty.plus(quantity);
  if (type === "SALIDA") afterQty = beforeQty.minus(quantity);
  if (type === "AJUSTE") afterQty = quantity;

  if (afterQty.lt(0)) throw new HttpError(422, "No se permite stock negativo.");

  const operation = async (tx) => {
    const updated = await tx.product.update({
      where: { id: productId },
      data: {
        stock: afterQty,
        cost: data.cost !== undefined && data.cost !== "" ? Number(data.cost) : undefined
      }
    });

    const movement = await tx.inventoryMovement.create({
      data: {
        productId,
        type,
        origin: data.origin || null,
        unitCost: data.unitCost !== undefined && data.unitCost !== null ? Number(data.unitCost) : Number(product.cost),
        quantity: type === "AJUSTE" ? afterQty.minus(beforeQty).abs() : quantity,
        beforeQty,
        afterQty,
        reason: data.reason || null,
        reference: data.reference || null,
        createdById: userId || null
      },
      include: includeMovement
    });

    return { product: { ...updated, stockStatus: statusFor(updated) }, movement };
  };

  return txContext ? operation(txContext) : prisma.$transaction(operation);
}
