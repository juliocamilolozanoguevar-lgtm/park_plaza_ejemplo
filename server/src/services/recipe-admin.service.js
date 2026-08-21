import { prisma } from "../config/prisma.js";
import { notFound } from "../utils/httpError.js";

const includeRecipe = {
  items: { include: { product: { include: { category: true } } } }
};

function normalizeItems(items = []) {
  return items
    .filter((item) => item.productId && Number(item.quantity) > 0)
    .map((item) => ({
      productId: Number(item.productId),
      quantity: Number(item.quantity),
      unit: item.unit
    }));
}

export function listRecipes(query = {}) {
  return prisma.recipe.findMany({
    where: {
      area: query.area || undefined,
      active: query.active === undefined ? undefined : query.active === "true",
      name: query.search ? { contains: query.search, mode: "insensitive" } : undefined
    },
    include: includeRecipe,
    orderBy: { name: "asc" }
  });
}

export async function createRecipe(data) {
  return prisma.recipe.create({
    data: {
      name: data.name,
      area: data.area,
      active: data.active ?? true,
      items: { create: normalizeItems(data.items) }
    },
    include: includeRecipe
  });
}

export async function updateRecipe(id, data) {
  const recipe = await prisma.recipe.findUnique({ where: { id } });
  if (!recipe) throw notFound("Receta no encontrada.");
  return prisma.recipe.update({
    where: { id },
    data: {
      name: data.name,
      area: data.area,
      active: data.active ?? recipe.active,
      items: {
        deleteMany: {},
        create: normalizeItems(data.items)
      }
    },
    include: includeRecipe
  });
}

export async function setRecipeActive(id, active) {
  await prisma.recipe.findUniqueOrThrow({ where: { id } });
  return prisma.recipe.update({ where: { id }, data: { active }, include: includeRecipe });
}
