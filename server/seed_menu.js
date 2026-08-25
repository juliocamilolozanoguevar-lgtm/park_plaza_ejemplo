import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando Seed de la Carta...");

  const restaurantMenu = [
    {
      name: "Saltados y Chaufas", area: "RESTAURANTE", items: [
        { name: "Chaufa Amazónica", price: 20 },
        { name: "Chaufa de Pollo", price: 20 },
        { name: "Chaufa de Res", price: 25 },
        { name: "Lomo Saltado de Res", price: 25 },
        { name: "Lomo Saltado de Pollo", price: 22 },
        { name: "Lomo Saltado Amazónico", price: 25 },
        { name: "Aeropuerto", price: 22 },
      ]
    },
    {
      name: "Platos Amazónicos", area: "RESTAURANTE", items: [
        { name: "Tacacho con Cecina", price: 25 },
        { name: "Tacacho con Chorizo", price: 22 },
        { name: "Parrilla con Patacones", price: 30 },
      ]
    },
    {
      name: "Ceviche", area: "RESTAURANTE", items: [
        { name: "Ceviche de Doncella", price: 35 },
      ]
    },
    {
      name: "Platos Criollos", area: "RESTAURANTE", items: [
        { name: "Tallarín Criollo de Pollo", price: 20 },
        { name: "Tallarín Criollo de Res", price: 22 },
        { name: "Tallarín Amazónico", price: 25 },
      ]
    },
    {
      name: "Frituras", area: "RESTAURANTE", items: [
        { name: "Chicharrón de Chancho", price: 28 },
        { name: "Chicharrón de Doncella", price: 30 },
        { name: "Chicharrón de Pollo", price: 25 },
        { name: "Pachamanca a la Piedra", price: 35 },
      ]
    },
    {
      name: "Broaster", area: "RESTAURANTE", items: [
        { name: "Alitas Broaster", price: 15 },
        { name: "Pierna Broaster", price: 18 },
        { name: "Pecho Broaster", price: 20 },
      ]
    },
    {
      name: "Guarniciones", area: "RESTAURANTE", items: [
        { name: "Arroz", price: 5 },
        { name: "Patacones", price: 8 },
        { name: "Maduro", price: 6 },
        { name: "Yuca Frita", price: 7 },
        { name: "Ensalada Fresca", price: 5 },
      ]
    },
    {
      name: "Tequeños", area: "RESTAURANTE", items: [
        { name: "Tequeños Clásicos", price: 12 },
        { name: "Tequeños Amazónicos", price: 15 },
        { name: "Tequeños Rellenos", price: 18 },
      ]
    }
  ];

  const bartenderMenu = [
    {
      name: "Los Clásicos del Bar", area: "BARTENDER", items: [
        { name: "Pisco Sour", price: 20 },
        { name: "Chilcano", price: 18 },
        { name: "Mojito", price: 18 },
        { name: "Piña Colada", price: 22 },
      ]
    },
    {
      name: "Tikis", area: "BARTENDER", items: [
        { name: "Mai Tai", price: 25 },
        { name: "Zombie", price: 28 },
      ]
    },
    {
      name: "Frappes", area: "BARTENDER", items: [
        { name: "Frappe de Café", price: 0, variants: [{ name: "Mediano", price: 12 }, { name: "Grande", price: 15 }] },
        { name: "Frappe de Oreo", price: 0, variants: [{ name: "Mediano", price: 14 }, { name: "Grande", price: 17 }] },
      ]
    },
    {
      name: "Autor", area: "BARTENDER", items: [
        { name: "Park Plaza Signature", price: 30 },
      ]
    },
    {
      name: "Café", area: "BARTENDER", items: [
        { name: "Espresso", price: 6 },
        { name: "Americano", price: 7 },
        { name: "Cappuccino", price: 9 },
      ]
    },
    {
      name: "Cerveza", area: "BARTENDER", items: [
        { name: "Pilsen Callao", price: 10 },
        { name: "Cusqueña", price: 12 },
        { name: "Corona", price: 15 },
      ]
    },
    {
      name: "Refrescos", area: "BARTENDER", items: [
        { name: "Limonada", price: 0, variants: [{ name: "Vaso", price: 5 }, { name: "Jarra", price: 15 }] },
        { name: "Maracuyá", price: 0, variants: [{ name: "Vaso", price: 6 }, { name: "Jarra", price: 16 }] },
        { name: "Chicha Morada", price: 0, variants: [{ name: "Vaso", price: 5 }, { name: "Jarra", price: 15 }] },
      ]
    },
    {
      name: "Gaseosas", area: "BARTENDER", items: [
        { name: "Inca Kola", price: 5 },
        { name: "Coca Cola", price: 5 },
      ]
    },
    {
      name: "Infusiones", area: "BARTENDER", items: [
        { name: "Manzanilla", price: 4 },
        { name: "Anís", price: 4 },
        { name: "Té Verde", price: 5 },
      ]
    }
  ];

  const fullMenu = [...restaurantMenu, ...bartenderMenu];

  await prisma.menuItemVariant.deleteMany({});
  await prisma.menuItem.deleteMany({});
  await prisma.menuCategory.deleteMany({});

  for (let i = 0; i < fullMenu.length; i++) {
    const catData = fullMenu[i];
    const category = await prisma.menuCategory.create({
      data: {
        name: catData.name,
        area: catData.area,
        displayOrder: i + 1,
        items: {
          create: catData.items.map((item, idx) => ({
            name: item.name,
            price: item.price,
            displayOrder: idx + 1,
            variants: item.variants ? {
              create: item.variants.map(v => ({
                name: v.name,
                price: v.price
              }))
            } : undefined
          }))
        }
      }
    });
    console.log(`Categoría creada: ${category.name} con ${catData.items.length} platos/bebidas`);
  }
  console.log("Seed de Carta completado exitosamente.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
