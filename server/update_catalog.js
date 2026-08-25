
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando actualizacion de catalogos...');
  
  console.log('Desactivando productos viejos...');
  await prisma.product.updateMany({
    where: { area: { in: ['RESTAURANTE', 'BARTENDER'] } },
    data: { active: false, status: 'INACTIVO' }
  });

  const restaurantCategories = ['Saltado y Chaufas', 'Platos Amazonico', 'Ceviche', 'Platos Criollos', 'Frituras', 'Guarniciones'];
  const barCategories = ['Los Clasicos del Bar', 'Tikis', 'Cerveza', 'Frappes', 'Refrescos', 'Autor', 'Cafe', 'Gaseosas', 'Infusiones'];

  console.log('Creando categorias...');
  const catMap = {};
  for (const name of [...restaurantCategories, ...barCategories]) {
    const exists = await prisma.category.findFirst({ where: { name } });
    if (exists) {
      catMap[name] = exists.id;
    } else {
      const created = await prisma.category.create({ data: { name, description: 'Catalogo oficial ' + name } });
      catMap[name] = created.id;
    }
  }

  const restaurantProducts = [
    ['Chaufa Amazonica', 'Saltado y Chaufas', 20],
    ['Chaufa de Pollo', 'Saltado y Chaufas', 20],
    ['Chaufa de Res', 'Saltado y Chaufas', 25],
    ['Lomo Saltado de Res', 'Saltado y Chaufas', 25],
    ['Lomo Saltado de Pollo', 'Saltado y Chaufas', 20],
    ['Lomo Saltado Amazonico', 'Saltado y Chaufas', 20],
    ['Aeropuerto', 'Saltado y Chaufas', 25],
    ['Tacacho con Cecina', 'Platos Amazonico', 20],
    ['Tacacho con Chorizo', 'Platos Amazonico', 20],
    ['Parrilla con Patacones', 'Platos Amazonico', 20],
    ['Ceviche de Doncella', 'Ceviche', 25],
    ['Tallarin Criollo de Pollo', 'Platos Criollos', 20],
    ['Tallarin Criollo de Res', 'Platos Criollos', 25],
    ['Tallarin Amazonico', 'Platos Criollos', 20],
    ['Chicharron de Chancho', 'Frituras', 30],
    ['Chicharron de Doncella', 'Frituras', 25],
    ['Chicharron de Pollo', 'Frituras', 20],
    ['Pachamanca a la Piedra', 'Frituras', 35],
    ['Broaster - Alitas', 'Frituras', 10],
    ['Broaster - Pierna', 'Frituras', 15],
    ['Broaster - Pecho', 'Frituras', 15],
    ['Arroz', 'Guarniciones', 5],
    ['Patacones', 'Guarniciones', 6],
    ['Maduro', 'Guarniciones', 5],
    ['Yuca Frita', 'Guarniciones', 8],
    ['Ensalada Fresca', 'Guarniciones', 8],
    ['Tequenos - Clasico', 'Guarniciones', 8],
    ['Tequenos - Amazonico', 'Guarniciones', 8],
    ['Tequenos - Relleno', 'Guarniciones', 8]
  ];

  const barProducts = [
    ['Chilcano Clasico', 'Los Clasicos del Bar', 18],
    ['Pisco Sour', 'Los Clasicos del Bar', 18],
    ['Machu Pichu', 'Los Clasicos del Bar', 18],
    ['Mojito Clasico', 'Los Clasicos del Bar', 18],
    ['Cuba Libre', 'Los Clasicos del Bar', 18],
    ['Pina Colada', 'Los Clasicos del Bar', 18],
    ['Algarrobina', 'Los Clasicos del Bar', 18],
    ['Pantera Rosa', 'Los Clasicos del Bar', 18],
    ['Fresa Colada', 'Los Clasicos del Bar', 18],
    ['Laguna Azul', 'Los Clasicos del Bar', 18],
    ['Tequila Sunrise', 'Los Clasicos del Bar', 20],
    ['Margarita Clasico o Blue', 'Los Clasicos del Bar', 20],
    ['Caipirinha', 'Los Clasicos del Bar', 18],
    ['Blue Hawai', 'Los Clasicos del Bar', 20],
    ['Moscow Mule', 'Los Clasicos del Bar', 18],
    ['Bey Liz Colado', 'Los Clasicos del Bar', 22],
    ['Mai Tai', 'Tikis', 25],
    ['Pain Killer', 'Tikis', 25],
    ['San Juan', 'Cerveza', 8],
    ['Trigo Lata Grande', 'Cerveza', 10],
    ['Corona', 'Cerveza', 10],
    ['Mike Manzana', 'Cerveza', 10],
    ['Mike Maracuya', 'Cerveza', 10],
    ['Smirnoff', 'Cerveza', 10],
    ['Pilsen Lata Grande', 'Cerveza', 10],
    ['Frappe Sublime (Mediana)', 'Frappes', 12],
    ['Frappe Sublime (Grande)', 'Frappes', 14],
    ['Frappe Moccacino (Mediana)', 'Frappes', 12],
    ['Frappe Moccacino (Grande)', 'Frappes', 14],
    ['Frappe Fresa (Mediana)', 'Frappes', 12],
    ['Frappe Fresa (Grande)', 'Frappes', 14],
    ['Frappe Chicle (Mediana)', 'Frappes', 12],
    ['Frappe Chicle (Grande)', 'Frappes', 14],
    ['Frappe Capuchino (Mediana)', 'Frappes', 12],
    ['Frappe Capuchino (Grande)', 'Frappes', 14],
    ['Frappe Vainilla (Mediana)', 'Frappes', 12],
    ['Frappe Vainilla (Grande)', 'Frappes', 14],
    ['Frappe Oreo (Mediana)', 'Frappes', 12],
    ['Frappe Oreo (Grande)', 'Frappes', 14],
    ['Refresco Maracuya (Vaso)', 'Refrescos', 5],
    ['Refresco Maracuya (Jarra)', 'Refrescos', 15],
    ['Refresco Camu Camu (Vaso)', 'Refrescos', 5],
    ['Refresco Camu Camu (Jarra)', 'Refrescos', 15],
    ['Limonada Frozen (Vaso)', 'Refrescos', 5],
    ['Limonada Frozen (Jarra)', 'Refrescos', 15],
    ['Punch de Limon', 'Autor', 18],
    ['Piscina Park Plaza', 'Autor', 22],
    ['Cafe Pasado', 'Cafe', 7],
    ['Cafe Americano', 'Cafe', 5],
    ['San Luis', 'Gaseosas', 3],
    ['Coca Cola', 'Gaseosas', 5],
    ['Inca Kola', 'Gaseosas', 5],
    ['Volt', 'Gaseosas', 3],
    ['Sporade', 'Gaseosas', 3],
    ['Bio', 'Gaseosas', 3],
    ['Guaranita', 'Gaseosas', 2],
    ['Agua Mineral c/ Gas', 'Gaseosas', 3],
    ['Agua Mineral s/ Gas', 'Gaseosas', 3],
    ['Te Canela y Clavo', 'Infusiones', 5],
    ['Te de Anis', 'Infusiones', 5],
    ['Te de Manzanilla', 'Infusiones', 5]
  ];

  console.log('Insertando productos nuevos...');
  let count = 0;
  for (const [name, catName, price] of restaurantProducts) {
    await prisma.product.create({
      data: {
        name,
        categoryId: catMap[catName],
        area: 'RESTAURANTE',
        unit: 'unidad',
        stock: 100,
        minStock: 5,
        cost: Number(price) * 0.5,
        price: Number(price),
        active: true,
        status: 'ACTIVO'
      }
    });
    count++;
  }
  
  for (const [name, catName, price] of barProducts) {
    await prisma.product.create({
      data: {
        name,
        categoryId: catMap[catName],
        area: 'BARTENDER',
        unit: 'unidad',
        stock: 100,
        minStock: 5,
        cost: Number(price) * 0.5,
        price: Number(price),
        active: true,
        status: 'ACTIVO'
      }
    });
    count++;
  }

  console.log(`Completado: ${count} productos creados.`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
