import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const products = [
  ["Arroz", "Alimentos", "RESTAURANTE", "kg", 25, 10, 4, 9],
  ["Aceite", "Alimentos", "RESTAURANTE", "litro", 8, 10, 7, 13],
  ["Pollo", "Alimentos", "RESTAURANTE", "kg", 0, 5, 11, 24],
  ["Carne", "Alimentos", "RESTAURANTE", "kg", 12, 5, 18, 36],
  ["Papas", "Alimentos", "RESTAURANTE", "kg", 30, 10, 3, 8],
  ["Tomate", "Alimentos", "RESTAURANTE", "kg", 9, 8, 3, 7],
  ["Lechuga", "Alimentos", "RESTAURANTE", "unidad", 6, 5, 2, 5],
  ["Gaseosas", "Bebidas", "RESTAURANTE", "unidad", 18, 10, 2, 6],
  ["Agua", "Bebidas", "RESTAURANTE", "unidad", 22, 10, 1.5, 4],
  ["Cerveza Corona", "Bebidas", "BARTENDER", "unidad", 5, 10, 4, 12],
  ["Pisco", "Licores", "BARTENDER", "botella", 7, 4, 32, 85],
  ["Ron", "Licores", "BARTENDER", "botella", 6, 4, 28, 70],
  ["Vodka", "Licores", "BARTENDER", "botella", 5, 3, 35, 90],
  ["Tequila", "Licores", "BARTENDER", "botella", 3, 3, 42, 110],
  ["Gin", "Licores", "BARTENDER", "botella", 4, 3, 38, 95],
  ["Whisky", "Licores", "BARTENDER", "botella", 2, 3, 55, 130],
  ["Tonica", "Bebidas", "BARTENDER", "unidad", 16, 8, 2, 7],
  ["Limon", "Alimentos", "BARTENDER", "kg", 4, 5, 4, 10],
  ["Jarabes", "Bebidas", "BARTENDER", "botella", 6, 4, 10, 24]
];

async function main() {
  const categories = {};
  for (const name of ["Alimentos", "Bebidas", "Licores", "Limpieza"]) {
    categories[name] = await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name }
    });
  }

  for (const [name, categoryName, area, unit, stock, minStock, cost, price] of products) {
    const categoryId = categories[categoryName].id;
    await prisma.product.upsert({
      where: { name_categoryId: { name, categoryId } },
      update: { area, unit, stock, minStock, cost, price, active: true, status: "ACTIVO" },
      create: { name, categoryId, area, unit, stock, minStock, cost, price }
    });
  }
}

main()
  .finally(async () => prisma.$disconnect());
