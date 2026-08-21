import bcrypt from "bcrypt";
import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const isProduction = process.env.NODE_ENV === "production";
const allowDemoSeed = process.env.ALLOW_DEMO_SEED === "true";
const password = "ParkPlaza123*";

const today = new Date();
today.setHours(0, 0, 0, 0);

function addDays(date, days, hour = 10, minute = 0) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  next.setHours(hour, minute, 0, 0);
  return next;
}

function money(value) {
  return Number(value).toFixed(2);
}

function pick(list, index) {
  return list[index % list.length];
}

async function ensureDemoUploads() {
  const dir = path.resolve("uploads", "demo");
  await fs.mkdir(dir, { recursive: true });
  const files = [
    ["room-clean-01.svg", "#0B6B3A", "Habitacion limpia"],
    ["room-clean-02.svg", "#FFB51B", "Checklist completo"],
    ["damage-window-01.svg", "#D64545", "Ventana reportada"],
    ["maintenance-shower-01.svg", "#1E4E8C", "Ducha en revision"]
  ];

  for (const [fileName, color, label] of files) {
    const filePath = path.join(dir, fileName);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640" viewBox="0 0 960 640"><rect width="960" height="640" fill="#f8fafc"/><rect x="80" y="80" width="800" height="480" rx="28" fill="${color}" opacity="0.14"/><rect x="150" y="150" width="660" height="330" rx="22" fill="#ffffff" stroke="${color}" stroke-width="12"/><text x="480" y="310" text-anchor="middle" font-family="Arial, sans-serif" font-size="54" font-weight="700" fill="${color}">Hotel Park Plaza</text><text x="480" y="380" text-anchor="middle" font-family="Arial, sans-serif" font-size="36" fill="#0f172a">${label}</text></svg>`;
    await fs.writeFile(filePath, svg, "utf8");
  }
}

async function cleanDevelopmentData() {
  if (isProduction && !allowDemoSeed) {
    throw new Error("Seed demo bloqueado: NODE_ENV=production. Para cargar datos demo locales ejecuta con ALLOW_DEMO_SEED=true.");
  }

  await prisma.auditLog.deleteMany();
  await prisma.attendanceRecord.deleteMany();
  await prisma.cashMovement.deleteMany();
  await prisma.cashRegister.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.operationalReportEvidence.deleteMany();
  await prisma.operationalReport.deleteMany();
  await prisma.eventContract.deleteMany();
  await prisma.poolReport.deleteMany();
  await prisma.cleaningReport.deleteMany();
  await prisma.inventoryMovement.deleteMany();
  await prisma.cleaningEvidence.deleteMany();
  await prisma.cleaningTask.deleteMany();
  await prisma.vehicleEntry.deleteMany();
  await prisma.parkingSpace.deleteMany();
  await prisma.poolEntry.deleteMany();
  await prisma.event.deleteMany();
  await prisma.eventSpace.deleteMany();
  await prisma.consumption.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.recipeItem.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.stay.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.room.deleteMany();
  await prisma.roomType.deleteMany();
  await prisma.purchaseItem.deleteMany();
  await prisma.purchase.deleteMany();
  await prisma.supplyRequestItem.deleteMany();
  await prisma.supplyRequest.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.client.deleteMany();
  await prisma.user.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.role.deleteMany();
  await prisma.hotelSettings.deleteMany();
}

async function createRolesAndUsers() {
  const modules = [
    "DASHBOARD", "RECEPCION", "CLIENTES", "RESERVAS", "HABITACIONES", "CHECK_IN", "CHECK_OUT",
    "PEDIDOS", "RESTAURANTE", "BARTENDER", "PISCINA", "EVENTOS", "COCHERA", "LIMPIEZA",
    "MANTENIMIENTO", "INVENTARIO", "COMPRAS", "PROVEEDORES", "PAGOS", "FACTURACION", "CAJA", "USUARIOS",
    "ROLES", "REPORTES", "AUDITORIA", "CONFIGURACION", "ASISTENCIA"
  ];
  const actions = ["VER", "CREAR", "EDITAR", "ELIMINAR"];
  const permissions = {};

  for (const module of modules) {
    for (const action of actions) {
      const permission = await prisma.permission.create({ data: { module, action } });
      permissions[`${module}:${action}`] = permission;
    }
  }

  const roles = {};
  for (const name of ["ADMINISTRADOR", "RECEPCIONISTA", "RESTAURANTE", "BARTENDER", "PISCINA", "LIMPIEZA", "MANTENIMIENTO"]) {
    roles[name] = await prisma.role.create({ data: { name, description: name.replace("_", " ") } });
  }

  await prisma.rolePermission.createMany({
    data: Object.values(permissions).map((permission) => ({
      roleId: roles.ADMINISTRADOR.id,
      permissionId: permission.id
    }))
  });

  const roleAccess = {
    RECEPCIONISTA: ["DASHBOARD", "RECEPCION", "CLIENTES", "RESERVAS", "HABITACIONES", "CHECK_IN", "CHECK_OUT", "PEDIDOS", "COCHERA", "PAGOS", "FACTURACION", "EVENTOS"],
    RESTAURANTE: ["DASHBOARD", "PEDIDOS", "RESTAURANTE", "INVENTARIO", "REPORTES"],
    BARTENDER: ["DASHBOARD", "PEDIDOS", "BARTENDER", "INVENTARIO", "REPORTES"],
    PISCINA: ["DASHBOARD", "PISCINA", "PEDIDOS", "REPORTES"],
    LIMPIEZA: ["DASHBOARD", "LIMPIEZA", "HABITACIONES", "REPORTES"],
    MANTENIMIENTO: ["MANTENIMIENTO", "REPORTES", "ASISTENCIA"]
  };

  for (const [roleName, allowedModules] of Object.entries(roleAccess)) {
    const data = [];
    for (const module of allowedModules) {
      for (const action of actions) {
        const permission = permissions[`${module}:${action}`];
        if (permission) data.push({ roleId: roles[roleName].id, permissionId: permission.id });
      }
    }
    await prisma.rolePermission.createMany({ data, skipDuplicates: true });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const usersData = [
    ["Admin", "General", "admin@parkplaza.com", "ADMINISTRADOR"],
    ["Maria", "Lopez", "recepcion@parkplaza.com", "RECEPCIONISTA"],
    ["Carlos", "Ruiz", "restaurante@parkplaza.com", "RESTAURANTE"],
    ["Luis", "Gomez", "bartender@parkplaza.com", "BARTENDER"],
    ["Ana", "Torres", "piscina@parkplaza.com", "PISCINA"],
    ["Lidia", "Ramos", "limpieza@parkplaza.com", "LIMPIEZA"],
    ["Juan", "Perez", "mantenimiento@parkplaza.com", "MANTENIMIENTO"]
  ];
  const userProfiles = {
    ADMINISTRADOR: ["10000001", "Administrador", "admin.general", "/assets/park-plaza-logo.png"],
    RECEPCIONISTA: ["70000012", "Recepcionista", "maria.lopez", null],
    RESTAURANTE: ["12345678", "Mesero", "carlos.ruiz", null],
    BARTENDER: ["87654321", "Bartender", "luis.gomez", null],
    PISCINA: ["23456789", "Operador de piscina", "ana.torres", null],
    LIMPIEZA: ["34567890", "Auxiliar de limpieza", "lidia.ramos", null],
    MANTENIMIENTO: ["45678901", "Tecnico de mantenimiento", "juan.perez", null]
  };

  const users = {};
  for (const [firstName, lastName, email, roleName] of usersData) {
    const [documentNumber, position, username, photoUrl] = userProfiles[roleName];
    users[roleName] = await prisma.user.create({
      data: { firstName, lastName, email, documentNumber, position, username, photoUrl, hireDate: addDays(today, -90, 8), passwordHash, roleId: roles[roleName].id }
    });
  }

  return { roles, users };
}

async function createSettings() {
  return prisma.hotelSettings.create({
    data: {
      id: 1,
      hotelName: "Hotel Park Plaza",
      address: "Pucallpa, Peru",
      phone: "061-555-2026",
      email: "reservas@parkplaza.com",
      logoUrl: "/assets/park-plaza-logo.png",
      currency: "PEN",
      taxRate: 18,
      timezone: "America/Lima"
    }
  });
}

async function createClients() {
  const names = [
    ["Juan", "Perez"], ["Maria", "Lopez"], ["Carlos", "Ruiz"], ["Ana", "Torres"], ["Luis", "Fernandez"],
    ["Lucia", "Gomez"], ["Diego", "Martinez"], ["Sofia", "Ramirez"], ["Julio", "Guevara"], ["Pedro", "Sanchez"],
    ["Elena", "Vargas"], ["Rosa", "Diaz"], ["Miguel", "Ramirez"], ["Andrea", "Flores"], ["Jose", "Castillo"],
    ["Daniela", "Torres"], ["Fernando", "Rojas"], ["Camila", "Vega"], ["Renzo", "Garcia"], ["Valeria", "Mendoza"],
    ["Hector", "Salazar"], ["Patricia", "Morales"], ["Alonso", "Paredes"], ["Karla", "Navarro"], ["Raul", "Campos"],
    ["Fiorella", "Aguilar"], ["Cesar", "Quispe"], ["Diana", "Leon"], ["Martin", "Herrera"], ["Gabriela", "Soto"],
    ["Oscar", "Reyes"], ["Natalia", "Medina"], ["Jorge", "Cabrera"], ["Claudia", "Vasquez"], ["Ricardo", "Ponce"],
    ["Paola", "Silva"], ["Manuel", "Rios"], ["Veronica", "Chavez"], ["Ivan", "Mejia"], ["Alejandra", "Arias"]
  ];

  const clients = [];
  for (let index = 0; index < names.length; index += 1) {
    const [firstName, lastName] = names[index];
    clients.push(await prisma.client.create({
      data: {
        documentType: index % 9 === 0 ? "CE" : "DNI",
        documentNumber: String(index % 9 === 0 ? 400000000 + index : 70000000 + index + 1),
        firstName,
        lastName,
        phone: `9${String(30000000 + index + 1)}`,
        email: `${firstName}.${lastName}.${index + 1}@demo.com`.toLowerCase(),
        address: `${index % 2 === 0 ? "Pucallpa" : "Yarinacocha"}, Peru`,
        status: index < 25 ? "HOSPEDADO" : "ACTIVO",
        registeredAt: addDays(today, -30 + index, 9)
      }
    }));
  }
  return clients;
}

async function createRooms() {
  const typeData = [
    ["SIMPLE", 120, 1],
    ["DOBLE", 160, 2],
    ["MATRIMONIAL", 220, 2],
    ["DELUXE", 280, 3],
    ["SUITE", 350, 4]
  ];
  const roomTypes = {};
  for (const [name, basePrice, capacity] of typeData) {
    roomTypes[name] = await prisma.roomType.create({
      data: { name, description: `Habitacion ${name.toLowerCase()} Hotel Park Plaza`, basePrice, capacity }
    });
  }

  const statusPlan = [
    ...Array(25).fill("OCUPADA"),
    ...Array(8).fill("LIBRE"),
    ...Array(6).fill("RESERVADA"),
    ...Array(5).fill("EN_LIMPIEZA"),
    ...Array(3).fill("MANTENIMIENTO"),
    ...Array(3).fill("FUERA_SERVICIO")
  ];
  const typeNames = Object.keys(roomTypes);
  const rooms = [];

  for (let floor = 1; floor <= 5; floor += 1) {
    for (let n = 1; n <= 10; n += 1) {
      const index = (floor - 1) * 10 + n - 1;
      const type = roomTypes[pick(typeNames, index)];
      rooms.push(await prisma.room.create({
        data: {
          number: `${floor}${String(n).padStart(2, "0")}`,
          floor,
          typeId: type.id,
          price: type.basePrice,
          capacity: type.capacity,
          description: `Piso ${floor}, vista ${index % 2 === 0 ? "principal" : "interior"}`,
          status: statusPlan[index]
        }
      }));
    }
  }

  return { roomTypes, rooms };
}

async function createReservationsAndStays({ clients, rooms }) {
  const reservations = [];
  const stays = [];
  const occupiedRooms = rooms.filter((room) => room.status === "OCUPADA");
  const cleaningRooms = rooms.filter((room) => room.status === "EN_LIMPIEZA");
  const reservedRooms = rooms.filter((room) => room.status === "RESERVADA");
  const availableRooms = rooms.filter((room) => ["LIBRE", "RESERVADA"].includes(room.status));

  for (let index = 0; index < occupiedRooms.length; index += 1) {
    const room = occupiedRooms[index];
    const client = clients[index];
    const checkInDate = index < 12 ? addDays(today, 0, 14, index % 4) : addDays(today, -((index % 4) + 1), 13);
    const checkOutDate = addDays(today, (index % 4) + 1, 11);
    const total = Number(room.price) * 2;
    const reservation = await prisma.reservation.create({
      data: {
        code: `RSV-2026-${String(index + 1).padStart(4, "0")}`,
        clientId: client.id,
        roomId: room.id,
        checkInDate,
        checkOutDate,
        adults: room.capacity >= 2 ? 2 : 1,
        children: index % 5 === 0 ? 1 : 0,
        totalPrice: total,
        advance: 100,
        balance: total - 100,
        status: "CHECKED_IN",
        notes: "Estadia activa demo"
      }
    });
    reservations.push(reservation);
    stays.push(await prisma.stay.create({
      data: { reservationId: reservation.id, clientId: client.id, roomId: room.id, checkInAt: checkInDate, status: "ACTIVA" }
    }));
  }

  for (let index = 0; index < cleaningRooms.length; index += 1) {
    const room = cleaningRooms[index];
    const client = clients[25 + index];
    const reservation = await prisma.reservation.create({
      data: {
        code: `RSV-2026-${String(26 + index).padStart(4, "0")}`,
        clientId: client.id,
        roomId: room.id,
        checkInDate: addDays(today, -3 - index, 15),
        checkOutDate: addDays(today, 0, 8 + index),
        adults: 2,
        totalPrice: Number(room.price) * 2,
        advance: 150,
        balance: 0,
        status: "COMPLETADA",
        notes: "Check-out reciente, requiere limpieza"
      }
    });
    reservations.push(reservation);
    stays.push(await prisma.stay.create({
      data: { reservationId: reservation.id, clientId: client.id, roomId: room.id, checkInAt: addDays(today, -3 - index, 15), checkOutAt: addDays(today, 0, 8 + index), status: "FINALIZADA" }
    }));
  }

  for (let index = 0; index < 6; index += 1) {
    const room = reservedRooms[index] || availableRooms[index];
    const client = clients[30 + index];
    reservations.push(await prisma.reservation.create({
      data: {
        code: `RSV-2026-${String(31 + index).padStart(4, "0")}`,
        clientId: client.id,
        roomId: room.id,
        checkInDate: addDays(today, index < 3 ? 0 : index + 1, 16),
        checkOutDate: addDays(today, index + 3, 11),
        adults: 2,
        children: index % 2,
        totalPrice: Number(room.price) * 2,
        advance: index % 2 === 0 ? 120 : 0,
        balance: Number(room.price) * 2 - (index % 2 === 0 ? 120 : 0),
        status: index % 2 === 0 ? "CONFIRMADA" : "PENDIENTE",
        notes: "Reserva futura demo"
      }
    }));
  }

  for (let index = 0; index < 3; index += 1) {
    const room = availableRooms[8 + index];
    const client = clients[36 + index];
    reservations.push(await prisma.reservation.create({
      data: {
        code: `RSV-2026-${String(37 + index).padStart(4, "0")}`,
        clientId: client.id,
        roomId: room.id,
        checkInDate: addDays(today, -index, 18),
        checkOutDate: addDays(today, 1, 11),
        adults: 1,
        totalPrice: Number(room.price),
        advance: 0,
        balance: Number(room.price),
        status: "NO_SHOW",
        notes: "No show demo"
      }
    }));
  }

  for (let index = 0; reservations.length < 40; index += 1) {
    const room = availableRooms[(12 + index) % availableRooms.length];
    const client = clients[(index + 5) % clients.length];
    const status = pick(["CONFIRMADA", "PENDIENTE", "CANCELADA", "COMPLETADA"], index);
    reservations.push(await prisma.reservation.create({
      data: {
        code: `RSV-2026-${String(reservations.length + 1).padStart(4, "0")}`,
        clientId: client.id,
        roomId: room.id,
        checkInDate: addDays(today, index % 2 === 0 ? index + 2 : -index - 2, 15),
        checkOutDate: addDays(today, index % 2 === 0 ? index + 4 : -index, 11),
        adults: 2,
        children: index % 3 === 0 ? 1 : 0,
        totalPrice: Number(room.price) * 2,
        advance: status === "CANCELADA" ? 0 : 100,
        balance: status === "COMPLETADA" ? 0 : Number(room.price) * 2 - 100,
        status,
        notes: "Reserva historica/futura demo"
      }
    }));
  }

  return { reservations, stays };
}

async function createCleaning({ rooms, users }) {
  const cleaningUser = users.LIMPIEZA;
  const roomsForCleaning = [
    ...rooms.filter((room) => room.status === "EN_LIMPIEZA"),
    rooms.find((room) => room.number === "104"),
    rooms.find((room) => room.number === "205"),
    rooms.find((room) => room.number === "305"),
    rooms.find((room) => room.number === "406"),
    rooms.find((room) => room.number === "507")
  ].filter(Boolean);

  const statuses = ["EN_LIMPIEZA", "PENDIENTE", "FINALIZADA", "PENDIENTE", "FINALIZADA", "EN_LIMPIEZA", "PENDIENTE", "FINALIZADA", "PENDIENTE", "EN_LIMPIEZA"];
  const tasks = [];
  for (let index = 0; index < 10; index += 1) {
    const room = roomsForCleaning[index % roomsForCleaning.length];
    const status = statuses[index];
    tasks.push(await prisma.cleaningTask.create({
      data: {
        roomId: room.id,
        status,
        priority: pick(["ALTA", "MEDIA", "BAJA", "CRITICA"], index),
        checkoutAt: addDays(today, -1, 11),
        assignedToId: cleaningUser.id,
        assignedTo: `${cleaningUser.firstName} ${cleaningUser.lastName}`,
        startedAt: status !== "PENDIENTE" ? addDays(today, 0, 9 + (index % 4)) : null,
        finishedAt: status === "FINALIZADA" ? addDays(today, 0, 12 + (index % 3)) : null,
        finishedById: status === "FINALIZADA" ? cleaningUser.id : null,
        bathroom: status === "FINALIZADA",
        bed: status === "FINALIZADA",
        floor: status === "FINALIZADA",
        surfaces: status === "FINALIZADA",
        amenities: status === "FINALIZADA",
        minibar: status === "FINALIZADA",
        finalCheck: status === "FINALIZADA"
      }
    }));
  }

  const evidenceFiles = [
    "/uploads/demo/room-clean-01.svg",
    "/uploads/demo/room-clean-02.svg",
    "/uploads/demo/damage-window-01.svg",
    "/uploads/demo/maintenance-shower-01.svg"
  ];
  for (let index = 0; index < 8; index += 1) {
    const task = tasks[index];
    await prisma.cleaningEvidence.create({
      data: {
        taskId: task.id,
        roomId: task.roomId,
        fileUrl: evidenceFiles[index % evidenceFiles.length],
        imageUrl: evidenceFiles[index % evidenceFiles.length],
        fileName: path.basename(evidenceFiles[index % evidenceFiles.length]),
        mimeType: "image/svg+xml",
        size: 2048,
        description: pick(["Cama tendida y habitacion ventilada", "Bano desinfectado", "Vidrio roto reportado", "Ducha revisada"], index),
        createdById: cleaningUser.id
      }
    });
  }

  const reportData = [
    [rooms.find((room) => room.number === "104") || rooms[3], tasks[0], "DANO", "Se encontro una ventana con el vidrio roto.", "ALTA", "ABIERTO"],
    [rooms.find((room) => room.number === "205") || rooms[14], tasks[2], "MANTENIMIENTO", "La ducha presenta baja presion.", "MEDIA", "EN_REVISION"],
    [rooms.find((room) => room.number === "305") || rooms[24], tasks[3], "OBJETO_PERDIDO", "Se encontro un cargador de telefono despues del check-out.", "BAJA", "RESUELTO"]
  ];

  for (const [room, task, type, description, priority, status] of reportData) {
    await prisma.cleaningReport.create({
      data: {
        roomId: room.id,
        cleaningTaskId: task.id,
        type,
        description,
        priority,
        status,
        reportedById: cleaningUser.id,
        resolvedAt: status === "RESUELTO" ? addDays(today, 0, 16) : null,
        resolvedById: status === "RESUELTO" ? cleaningUser.id : null
      }
    });
  }

  return tasks;
}

async function createEvents({ clients }) {
  const terraza = await prisma.eventSpace.create({ data: { name: "TERRAZA", capacity: 80, basePrice: 1200 } });
  const mirador = await prisma.eventSpace.create({ data: { name: "MIRADOR", capacity: 140, basePrice: 1800 } });
  const names = ["Cumpleanos", "Matrimonio", "Reunion Corporativa", "Aniversario", "Graduacion", "Baby Shower", "Cena Empresarial", "Pedida de mano", "Promocion escolar", "Conferencia"];
  const events = [];

  for (let index = 0; index < 10; index += 1) {
    const price = [900, 3500, 1800, 1200, 1600][index % 5];
    const advance = index === 1 ? 1500 : Math.round(price * (index % 3 === 0 ? 0.5 : 0.3));
    const event = await prisma.event.create({
      data: {
        clientId: clients[10 + index].id,
        spaceId: index % 2 === 0 ? terraza.id : mirador.id,
        name: names[index],
        type: pick(["Social", "Boda", "Corporativo", "Familiar", "Academico"], index),
        startsAt: addDays(today, index < 2 ? -index - 1 : index === 2 ? 0 : index + 1, 18),
        endsAt: addDays(today, index < 2 ? -index - 1 : index === 2 ? 0 : index + 1, 23),
        guests: [35, 90, 45, 55, 70][index % 5],
        price,
        advance,
        balance: price - advance,
        status: pick(["FINALIZADO", "CONFIRMADO", "RESERVADO", "COTIZACION"], index),
        notes: "Evento demo con pagos y seguimiento"
      }
    });
    events.push(event);

    if (index < 6) {
      await prisma.eventContract.create({
        data: {
          eventId: event.id,
          terms: "Contrato demo: reserva de espacio, servicio basico y condiciones de cancelacion.",
          amount: price,
          status: event.status === "COTIZACION" ? "BORRADOR" : "ACTIVO"
        }
      });
    }
  }

  return events;
}

async function createParking({ clients }) {
  const spaces = [];
  for (let index = 1; index <= 20; index += 1) {
    spaces.push(await prisma.parkingSpace.create({
      data: { code: `A${index}`, status: index <= 12 ? "OCUPADO" : "LIBRE" }
    }));
  }

  const vehicles = [
    ["ABC-123", "Toyota", "Corolla", "Gris"], ["XYZ-789", "Hyundai", "Tucson", "Negro"], ["DEF-456", "Chevrolet", "Onix", "Blanco"],
    ["GHI-321", "Kia", "Rio", "Rojo"], ["JKL-654", "Nissan", "Sentra", "Azul"], ["MNO-987", "Mazda", "CX-5", "Plata"],
    ["PQR-852", "Suzuki", "Swift", "Verde"], ["STU-741", "Volkswagen", "Gol", "Blanco"], ["VWX-963", "Honda", "Civic", "Negro"],
    ["YZA-159", "Ford", "EcoSport", "Gris"], ["BCD-753", "Renault", "Duster", "Arena"], ["EFG-951", "Toyota", "Hilux", "Rojo"]
  ];

  for (let index = 0; index < vehicles.length; index += 1) {
    const [plate, brand, model, color] = vehicles[index];
    await prisma.vehicleEntry.create({
      data: {
        spaceId: spaces[index].id,
        clientId: clients[index].id,
        plate,
        brand,
        model,
        color,
        entryAt: addDays(today, index % 3 === 0 ? -1 : 0, 8 + (index % 6)),
        status: "ACTIVO"
      }
    });
  }

  return spaces;
}

async function createInventoryAndPurchases({ users }) {
  const categoryNames = ["Carnes", "Verduras", "Abarrotes", "Condimentos", "Lacteos", "Bebidas", "Otros", "Licores", "Cervezas", "Mezcladores", "Frutas", "Jarabes"];
  const categories = {};
  for (const name of categoryNames) {
    categories[name] = await prisma.category.create({ data: { name, description: `Categoria demo ${name}` } });
  }

  const restaurantProducts = [
    ["Arroz", "Abarrotes", "kg", 25, 10, 3, 8], ["Pollo", "Carnes", "kg", 0, 5, 9, 22], ["Carne de res", "Carnes", "kg", 14, 6, 18, 38],
    ["Papa", "Verduras", "kg", 30, 12, 2, 6], ["Tomate", "Verduras", "kg", 9, 8, 3, 7], ["Cebolla", "Verduras", "kg", 11, 8, 2, 6],
    ["Lechuga", "Verduras", "unidad", 4, 6, 2, 5], ["Aceite", "Abarrotes", "litro", 8, 10, 7, 14], ["Sal", "Condimentos", "kg", 12, 5, 1, 3],
    ["Pimienta", "Condimentos", "kg", 2, 3, 12, 24], ["Queso Mozzarella", "Lacteos", "kg", 20, 15, 18, 32], ["Huevos", "Abarrotes", "docena", 18, 10, 7, 14],
    ["Leche", "Lacteos", "litro", 6, 10, 4, 9], ["Pan", "Abarrotes", "unidad", 40, 20, 0.5, 2], ["Fideos", "Abarrotes", "kg", 15, 8, 3, 8],
    ["Azucar", "Abarrotes", "kg", 7, 10, 3, 7], ["Agua", "Bebidas", "botella", 35, 20, 1, 4], ["Gaseosa", "Bebidas", "botella", 14, 12, 3, 8],
    ["Lomo fino", "Carnes", "kg", 5, 4, 30, 58], ["Pescado fresco", "Carnes", "kg", 3, 5, 20, 42], ["Aji amarillo", "Condimentos", "kg", 4, 4, 6, 14],
    ["Culantro", "Verduras", "atado", 2, 5, 1, 3], ["Cafe", "Bebidas", "kg", 6, 4, 18, 38], ["Mantequilla", "Lacteos", "kg", 3, 5, 15, 30]
  ];
  const barProducts = [
    ["Cerveza Corona", "Cervezas", "unidad", 5, 10, 4, 12], ["Pisco", "Licores", "botella", 8, 5, 28, 75], ["Ron", "Licores", "botella", 4, 5, 25, 60],
    ["Vodka", "Licores", "botella", 0, 3, 32, 85], ["Tequila", "Licores", "botella", 6, 4, 35, 95], ["Gin", "Licores", "botella", 5, 4, 38, 98],
    ["Whisky", "Licores", "botella", 3, 3, 60, 160], ["Tonica", "Mezcladores", "unidad", 18, 12, 2, 7], ["Limon", "Frutas", "kg", 7, 8, 3, 8],
    ["Hierbabuena", "Frutas", "atado", 3, 5, 1, 4], ["Azucar rubia", "Abarrotes", "kg", 6, 5, 3, 8], ["Hielo", "Otros", "bolsa", 12, 10, 4, 10],
    ["Jarabe de goma", "Jarabes", "botella", 2, 4, 10, 24], ["Agua mineral", "Bebidas", "botella", 20, 15, 1, 5], ["Gaseosa ginger", "Mezcladores", "botella", 9, 8, 3, 9]
  ];

  const products = {};
  for (const [name, categoryName, unit, stock, minStock, cost, price] of restaurantProducts) {
    products[name] = await prisma.product.create({ data: { name, categoryId: categories[categoryName].id, area: "RESTAURANTE", unit, stock, minStock, cost, price } });
  }
  for (const [name, categoryName, unit, stock, minStock, cost, price] of barProducts) {
    products[name] = await prisma.product.create({ data: { name, categoryId: categories[categoryName].id, area: "BARTENDER", unit, stock, minStock, cost, price } });
  }

  for (const product of Object.values(products)) {
    const finalStock = Number(product.stock);
    await prisma.inventoryMovement.createMany({
      data: [
        { productId: product.id, type: "ENTRADA", quantity: finalStock + 7, beforeQty: 0, afterQty: finalStock + 7, reason: "Carga inicial demo", reference: "SEED", createdById: users.ADMINISTRADOR.id, createdAt: addDays(today, -7, 9) },
        { productId: product.id, type: "SALIDA", quantity: 5, beforeQty: finalStock + 7, afterQty: finalStock + 2, reason: "Consumo operativo", reference: "DEMO-SALIDA", createdById: users.RESTAURANTE.id, createdAt: addDays(today, -2, 18) },
        { productId: product.id, type: "AJUSTE", quantity: -2, beforeQty: finalStock + 2, afterQty: finalStock, reason: "Ajuste inventario demo", reference: "DEMO-AJUSTE", createdById: users.ADMINISTRADOR.id, createdAt: addDays(today, -1, 17) }
      ]
    });
  }

  async function createRecipe(name, area, items) {
    const recipe = await prisma.recipe.create({ data: { name, area } });
    for (const [productName, quantity, unit] of items) {
      const product = products[productName];
      if (!product) continue;
      await prisma.recipeItem.create({
        data: {
          recipeId: recipe.id,
          productId: product.id,
          quantity,
          unit: unit || product.unit
        }
      });
    }
  }

  await createRecipe("Lomo Saltado", "RESTAURANTE", [["Lomo fino", 0.18, "kg"], ["Papa", 0.2, "kg"], ["Tomate", 0.08, "kg"], ["Cebolla", 0.06, "kg"], ["Aceite", 0.03, "litro"]]);
  await createRecipe("Arroz con Pollo", "RESTAURANTE", [["Arroz", 0.18, "kg"], ["Pollo", 0.22, "kg"], ["Culantro", 0.05, "atado"], ["Aji amarillo", 0.03, "kg"], ["Aceite", 0.02, "litro"]]);
  await createRecipe("Pollo a la Plancha", "RESTAURANTE", [["Pollo", 0.25, "kg"], ["Papa", 0.18, "kg"], ["Lechuga", 0.2, "unidad"], ["Aceite", 0.02, "litro"]]);
  await createRecipe("Ceviche", "RESTAURANTE", [["Pescado fresco", 0.22, "kg"], ["Cebolla", 0.06, "kg"], ["Aji amarillo", 0.02, "kg"], ["Sal", 0.01, "kg"]]);
  await createRecipe("Hamburguesa", "RESTAURANTE", [["Pan", 1, "unidad"], ["Carne de res", 0.15, "kg"], ["Queso Mozzarella", 0.03, "kg"], ["Lechuga", 0.2, "unidad"], ["Tomate", 0.04, "kg"]]);
  await createRecipe("Desayuno Continental", "RESTAURANTE", [["Pan", 2, "unidad"], ["Huevos", 0.17, "docena"], ["Cafe", 0.02, "kg"], ["Leche", 0.2, "litro"], ["Mantequilla", 0.02, "kg"]]);
  await createRecipe("Mojito", "BARTENDER", [["Ron", 0.12, "botella"], ["Hierbabuena", 0.15, "atado"], ["Azucar rubia", 0.03, "kg"], ["Hielo", 1, "bolsa"], ["Agua mineral", 1, "botella"]]);
  await createRecipe("Pisco Sour", "BARTENDER", [["Pisco", 0.12, "botella"], ["Limon", 0.09, "kg"], ["Jarabe de goma", 0.1, "botella"], ["Hielo", 1, "bolsa"]]);
  await createRecipe("Cuba Libre", "BARTENDER", [["Ron", 0.1, "botella"], ["Gaseosa ginger", 1, "botella"], ["Limon", 0.03, "kg"], ["Hielo", 1, "bolsa"]]);
  await createRecipe("Gin Tonic", "BARTENDER", [["Gin", 0.1, "botella"], ["Tonica", 1, "unidad"], ["Limon", 0.03, "kg"], ["Hielo", 1, "bolsa"]]);

  const supplierData = [
    ["20100000001", "Distribuidora Ucayali SAC", "Ramon Salas"], ["20100000002", "Bebidas Amazonicas SAC", "Carla Benites"],
    ["20100000003", "Alimentos del Oriente SAC", "Nestor Pinedo"], ["20100000004", "Comercial Pucallpa EIRL", "Patricia Rengifo"],
    ["20100000005", "Servicios Hoteleros Selva SAC", "Mario Tello"], ["20100000006", "Carnes Premium Oriente SAC", "Lucia Angulo"],
    ["20100000007", "Lacteos del Valle SAC", "Jorge Palma"], ["20100000008", "Frutas Tropicales EIRL", "Rosa Rivas"],
    ["20100000009", "Insumos Gourmet Peru SAC", "Felipe Cardenas"], ["20100000010", "Abarrotes San Jose SAC", "Elena Nuñez"]
  ];
  const suppliers = [];
  for (const [ruc, name, contact] of supplierData) {
    suppliers.push(await prisma.supplier.create({
      data: { ruc, name, contact, phone: `061-${ruc.slice(-6)}`, email: `${name.toLowerCase().replaceAll(" ", ".")}@demo.com`, address: "Pucallpa, Peru" }
    }));
  }

  const productList = Object.values(products);
  for (let index = 0; index < 8; index += 1) {
    const status = pick(["BORRADOR", "PENDIENTE", "APROBADA", "RECIBIDA"], index);
    const selected = [productList[index], productList[index + 8], productList[index + 16]].filter(Boolean);
    const total = selected.reduce((sum, product) => sum + Number(product.cost) * (6 + index), 0);
    const purchase = await prisma.purchase.create({
      data: {
        supplierId: suppliers[index % suppliers.length].id,
        status,
        total,
        createdById: users.ADMINISTRADOR.id,
        receivedAt: status === "RECIBIDA" ? addDays(today, -1, 10) : null,
        createdAt: addDays(today, -8 + index, 11)
      }
    });
    for (const product of selected) {
      await prisma.purchaseItem.create({ data: { purchaseId: purchase.id, productId: product.id, quantity: 6 + index, cost: product.cost } });
      if (status === "RECIBIDA") {
        const beforeQty = Number(product.stock) - (6 + index);
        await prisma.inventoryMovement.create({
          data: { productId: product.id, type: "ENTRADA_COMPRA", quantity: 6 + index, beforeQty, afterQty: Number(product.stock), reason: "Compra recibida demo", reference: `COMPRA-${purchase.id}`, createdById: users.ADMINISTRADOR.id, createdAt: addDays(today, -1, 10) }
        });
      }
    }
  }

  return { categories, products, suppliers };
}

async function createOrdersAndConsumptions({ clients, rooms, stays, products, users }) {
  const activeStays = stays.filter((stay) => stay.status === "ACTIVA");
  const restaurantItems = ["Lomo Saltado", "Arroz con Pollo", "Pollo a la Plancha", "Ceviche", "Hamburguesa", "Desayuno Continental"];
  const barItems = ["Mojito", "Pisco Sour", "Cuba Libre", "Gin Tonic", "Cerveza Corona", "Whisky"];
  const orders = [];

  async function createOrder(area, index, status, itemName, price) {
    const stay = activeStays[index % activeStays.length];
    const order = await prisma.order.create({
      data: {
        code: `${area === "RESTAURANTE" ? "RES" : "BAR"}-2026-${String(index + 1).padStart(4, "0")}`,
        area,
        clientId: stay.clientId,
        roomId: stay.roomId,
        stayId: stay.id,
        status,
        total: price,
        notes: `${area} demo`,
        createdById: area === "RESTAURANTE" ? users.RESTAURANTE.id : users.BARTENDER.id,
        createdAt: addDays(today, index % 4 === 0 ? -1 : 0, 11 + (index % 8))
      }
    });
    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        productId: area === "RESTAURANTE" ? products.Arroz?.id : products["Cerveza Corona"]?.id,
        name: itemName,
        category: area === "RESTAURANTE" ? "Plato" : "Bebida",
        price,
        quantity: 1
      }
    });
    if (status === "ENTREGADO") {
      await prisma.consumption.create({
        data: { clientId: stay.clientId, stayId: stay.id, orderId: order.id, area, concept: itemName, amount: price, status: index % 2 === 0 ? "PENDIENTE" : "PAGADO", createdAt: addDays(today, 0, 13 + (index % 6)) }
      });
    }
    orders.push(order);
  }

  for (let index = 0; index < 20; index += 1) {
    await createOrder("RESTAURANTE", index, pick(["PENDIENTE", "EN_COCINA", "PREPARANDO", "LISTO", "ENTREGADO"], index), pick(restaurantItems, index), [65, 48, 55, 70, 38, 32][index % 6]);
  }
  for (let index = 0; index < 15; index += 1) {
    await createOrder("BARTENDER", index, pick(["PENDIENTE", "PREPARANDO", "LISTO", "ENTREGADO"], index), pick(barItems, index), [28, 32, 30, 35, 12, 45][index % 6]);
  }

  await prisma.consumption.create({
    data: { clientId: clients[0].id, stayId: activeStays[0].id, area: "PISCINA", concept: "Ingreso piscina huesped", amount: 20, status: "PENDIENTE", createdAt: addDays(today, 0, 14) }
  });

  return orders;
}

async function createPool({ clients, reservations, events, users }) {
  const entries = [];
  for (let index = 0; index < 20; index += 1) {
    const status = index < 8 ? "ACTIVO" : "FINALIZADO";
    entries.push(await prisma.poolEntry.create({
      data: {
        clientId: clients[index % clients.length].id,
        reservationId: reservations[index % reservations.length].id,
        eventId: index % 7 === 0 ? events[index % events.length].id : null,
        type: pick(["HUESPED", "CLIENTE_EXTERNO", "EVENTO"], index),
        qrCode: `POOL-2026-${String(index + 1).padStart(4, "0")}`,
        people: (index % 4) + 1,
        entryAt: addDays(today, index % 3 === 0 ? -1 : 0, 9 + (index % 8)),
        exitAt: status === "FINALIZADO" ? addDays(today, 0, 15 + (index % 4)) : null,
        status,
        createdById: users.PISCINA.id
      }
    }));
  }

  const reports = [
    ["QUEJA", "El cliente reporta demora en la atencion.", "MEDIA", "ABIERTO"],
    ["INCIDENTE", "Se encontro piso humedo cerca del acceso.", "ALTA", "EN_REVISION"],
    ["OBSERVACION", "Cliente solicito cambio de mesa.", "BAJA", "RESUELTO"]
  ];
  for (let index = 0; index < reports.length; index += 1) {
    const [type, description, priority, status] = reports[index];
    await prisma.poolReport.create({
      data: { clientId: clients[index].id, type, description, priority, status, reportedById: users.PISCINA.id, createdAt: addDays(today, -index, 13) }
    });
  }

  return entries;
}

async function createOperationalReports({ rooms, products, tasks, users }) {
  const reportData = [
    ["LIMPIEZA", "DANO_INFRAESTRUCTURA", "Se encontro una ventana con el vidrio roto.", "ALTA", "ABIERTO", rooms.find((room) => room.number === "104"), null, tasks[0], users.LIMPIEZA],
    ["LIMPIEZA", "MANTENIMIENTO", "La ducha presenta baja presion.", "MEDIA", "EN_REVISION", rooms.find((room) => room.number === "205"), null, tasks[2], users.LIMPIEZA],
    ["LIMPIEZA", "OBJETO_PERDIDO", "Se encontro un cargador de telefono despues del check-out.", "BAJA", "RESUELTO", rooms.find((room) => room.number === "305"), null, tasks[3], users.LIMPIEZA],
    ["RESTAURANTE", "FALTA_INSUMO", "Stock insuficiente de aceite para el turno de la noche.", "ALTA", "ABIERTO", null, products.Aceite, null, users.RESTAURANTE],
    ["RESTAURANTE", "DANO_EQUIPO", "Horno principal presenta falla de encendido.", "CRITICA", "EN_REVISION", null, null, null, users.RESTAURANTE],
    ["RESTAURANTE", "INCIDENCIA", "Demora en salida de platos por alta demanda.", "MEDIA", "ABIERTO", null, null, null, users.RESTAURANTE],
    ["RESTAURANTE", "FALTA_INSUMO", "Lechuga por debajo del minimo.", "MEDIA", "RESUELTO", null, products.Lechuga, null, users.RESTAURANTE],
    ["RESTAURANTE", "FALTA_INSUMO", "Pollo sin stock para carta nocturna.", "ALTA", "ABIERTO", null, products.Pollo, null, users.RESTAURANTE],
    ["BARTENDER", "FALTA_INSUMO", "Cerveza Corona por debajo del minimo.", "MEDIA", "ABIERTO", null, products["Cerveza Corona"], null, users.BARTENDER],
    ["BARTENDER", "DANO_EQUIPO", "La licuadora no enciende.", "ALTA", "EN_REVISION", null, null, null, users.BARTENDER],
    ["BARTENDER", "FALTA_INSUMO", "Vodka sin stock.", "ALTA", "ABIERTO", null, products.Vodka, null, users.BARTENDER],
    ["BARTENDER", "OBSERVACION", "Cliente solicito bebida sin alcohol.", "BAJA", "RESUELTO", null, null, null, users.BARTENDER],
    ["PISCINA", "QUEJA", "Demora en atencion de toallas.", "MEDIA", "ABIERTO", null, null, null, users.PISCINA],
    ["PISCINA", "INCIDENTE", "Piso humedo cerca del acceso.", "ALTA", "EN_REVISION", null, null, null, users.PISCINA],
    ["LIMPIEZA", "FALTA_INSUMO", "Faltan amenities para reposicion.", "MEDIA", "RESUELTO", rooms.find((room) => room.number === "406"), null, tasks[4], users.LIMPIEZA],
    ["RESTAURANTE", "OBSERVACION", "Proveedor entrego pedido incompleto.", "MEDIA", "RESUELTO", null, null, null, users.RESTAURANTE],
    ["BARTENDER", "FALTA_INSUMO", "Hierbabuena cerca del minimo.", "MEDIA", "EN_REVISION", null, products.Hierbabuena, null, users.BARTENDER],
    ["LIMPIEZA", "INCIDENCIA", "Habitacion requiere sanitizacion adicional.", "ALTA", "RESUELTO", rooms.find((room) => room.number === "507"), null, tasks[5], users.LIMPIEZA]
  ];

  const reports = [];
  for (let index = 0; index < reportData.length; index += 1) {
    const [area, type, description, priority, status, room, product, task, user] = reportData[index];
    const requiresMaintenance = ["DANO_EQUIPO", "DANO_INFRAESTRUCTURA", "MANTENIMIENTO"].includes(type);
    const report = await prisma.operationalReport.create({
      data: {
        code: `${area.slice(0, 3)}-${String(index + 1).padStart(4, "0")}`,
        area,
        type,
        description,
        priority,
        status,
        requiresMaintenance,
        reportedById: user.id,
        assignedToId: requiresMaintenance && status !== "ABIERTO" ? users.MANTENIMIENTO.id : null,
        resolvedById: status === "RESUELTO" ? (requiresMaintenance ? users.MANTENIMIENTO.id : users.ADMINISTRADOR.id) : null,
        roomId: room?.id || null,
        productId: product?.id || null,
        cleaningTaskId: task?.id || null,
        startedAt: requiresMaintenance && status !== "ABIERTO" ? addDays(today, -Math.floor(index / 3), 10 + (index % 7)) : null,
        workDescription: requiresMaintenance && status === "RESUELTO" ? "Trabajo tecnico resuelto y validado en ambiente operativo." : null,
        observations: requiresMaintenance && status === "RESUELTO" ? "Se deja registro demo para seguimiento de mantenimiento." : null,
        createdAt: addDays(today, -Math.floor(index / 3), 9 + (index % 8)),
        resolvedAt: status === "RESUELTO" ? addDays(today, 0, 17) : null
      }
    });
    reports.push(report);
    if (index < 6) {
      await prisma.operationalReportEvidence.create({
        data: {
          reportId: report.id,
          imageUrl: index % 2 === 0 ? "/uploads/demo/damage-window-01.svg" : "/uploads/demo/maintenance-shower-01.svg",
          fileName: "demo-report.svg",
          mimeType: "image/svg+xml",
          size: 2048
        }
      });
    }
  }

  return reports;
}

async function createPaymentsCashAndInvoices({ clients, reservations, stays, events, users }) {
  const cash = await prisma.cashRegister.create({
    data: { openedById: users.ADMINISTRADOR.id, openingCash: 1000, status: "ABIERTA", openedAt: addDays(today, 0, 7) }
  });

  const payments = [];
  const paymentData = [
    ["Habitaciones", "Hospedaje y checkout", 1600, "EFECTIVO", clients[0], reservations[0], stays[0], null],
    ["Restaurante", "Ventas restaurante", 980, "TARJETA", clients[1], null, stays[1], null],
    ["Bartender", "Ventas bartender", 640, "YAPE", clients[2], null, stays[2], null],
    ["Piscina", "Ingresos piscina", 320, "PLIN", clients[3], null, stays[3], null],
    ["Eventos", "Adelanto evento Matrimonio", 1500, "TRANSFERENCIA", clients[11], null, null, events[1]],
    ["Reservas", "Adelantos reservas", 280, "EFECTIVO", clients[4], reservations[4], null, null]
  ];

  for (let index = 0; index < paymentData.length; index += 1) {
    const [area, concept, amount, method, client, reservation, stay, event] = paymentData[index];
    const payment = await prisma.payment.create({
      data: {
        clientId: client?.id || null,
        reservationId: reservation?.id || null,
        stayId: stay?.id || null,
        eventId: event?.id || null,
        method,
        reference: `${method}-DEMO-${index + 1}`,
        area,
        concept,
        amount,
        paidAt: addDays(today, 0, 9 + index),
        createdById: users.ADMINISTRADOR.id
      }
    });
    payments.push(payment);
    await prisma.cashMovement.create({
      data: {
        cashRegisterId: cash.id,
        paymentId: payment.id,
        type: "INGRESO",
        category: area,
        method,
        concept,
        amount,
        createdById: users.ADMINISTRADOR.id,
        createdAt: payment.paidAt
      }
    });
  }

  const expenses = [
    ["Compras restaurante", 420, "TRANSFERENCIA"],
    ["Mantenimiento piscina", 180, "EFECTIVO"],
    ["Reposicion lavanderia", 95, "YAPE"]
  ];
  for (const [concept, amount, method] of expenses) {
    await prisma.cashMovement.create({
      data: { cashRegisterId: cash.id, type: "EGRESO", category: "OPERACION", method, concept, amount, createdById: users.ADMINISTRADOR.id, createdAt: addDays(today, 0, 16) }
    });
  }

  for (let index = 0; index < payments.length; index += 1) {
    const payment = payments[index];
    const subtotal = Number(payment.amount) / 1.18;
    const tax = Number(payment.amount) - subtotal;
    await prisma.invoice.create({
      data: {
        type: index % 2 === 0 ? "BOLETA" : "FACTURA",
        series: index % 2 === 0 ? "B001" : "F001",
        number: index + 1,
        clientId: payment.clientId || clients[0].id,
        paymentId: payment.id,
        subtotal,
        tax,
        total: Number(payment.amount),
        issuedAt: payment.paidAt
      }
    });
  }

  return { cash, payments };
}

async function createAttendance({ users }) {
  await prisma.attendanceRecord.createMany({
    data: [
      { userId: users.RECEPCIONISTA.id, checkInAt: addDays(today, 0, 7, 30), status: "PRESENTE" },
      { userId: users.RESTAURANTE.id, checkInAt: addDays(today, 0, 8, 3), checkOutAt: addDays(today, 0, 17, 12), durationMinutes: 549, status: "FINALIZADA" },
      { userId: users.BARTENDER.id, checkInAt: addDays(today, 0, 8, 10), status: "PRESENTE" },
      { userId: users.LIMPIEZA.id, checkInAt: addDays(today, 0, 8, 15), status: "PRESENTE" },
      { userId: users.MANTENIMIENTO.id, checkInAt: addDays(today, 0, 7, 58), checkOutAt: addDays(today, 0, 17, 20), durationMinutes: 562, status: "FINALIZADA" },
      { userId: users.PISCINA.id, checkInAt: addDays(today, -1, 8, 0), status: "REQUIERE_REVISION", reviewReason: "Jornada anterior abierta detectada en prueba." }
    ]
  });
}

async function createAuditLogs({ users }) {
  const logs = [
    [users.ADMINISTRADOR, "LOGIN", "AUTH", "Admin inicio sesion."],
    [users.RECEPCIONISTA, "CREAR", "RESERVAS", "Recepcion creo reserva RSV-2026-0012."],
    [users.RECEPCIONISTA, "CHECK_IN", "RECEPCION", "Recepcion realizo check-in habitacion 204."],
    [users.RECEPCIONISTA, "PAGO", "CAJA", "Recepcion registro pago S/ 500."],
    [users.LIMPIEZA, "FINALIZAR", "LIMPIEZA", "Limpieza finalizo habitacion 103."],
    [users.MANTENIMIENTO, "INICIAR", "MANTENIMIENTO", "Mantenimiento inicio reparacion de incidencia tecnica."],
    [users.BARTENDER, "ENTREGAR", "BARTENDER", "Bartender entrego pedido BAR-2026-0004."],
    [users.ADMINISTRADOR, "RESOLVER", "REPORTES", "Administrador resolvio incidencia operativa."],
    [users.RESTAURANTE, "ACTUALIZAR", "RESTAURANTE", "Restaurante paso pedido a preparacion."],
    [users.PISCINA, "CREAR", "PISCINA", "Piscina genero QR POOL-2026-0001."]
  ];

  for (let index = 0; index < logs.length; index += 1) {
    const [user, action, module, description] = logs[index];
    await prisma.auditLog.create({
      data: { userId: user.id, action, module, description, detail: description, ip: "127.0.0.1", createdAt: addDays(today, 0, 8 + index) }
    });
  }
}

async function validateDemoData() {
  const checks = [
    ["Room", 50, () => prisma.room.count()],
    ["User", 6, () => prisma.user.count()],
    ["Client", 30, () => prisma.client.count()],
    ["Reservation", 40, () => prisma.reservation.count()],
    ["Payment", 1, () => prisma.payment.count()],
    ["Product RESTAURANTE", 1, () => prisma.product.count({ where: { area: "RESTAURANTE" } })],
    ["Product BARTENDER", 1, () => prisma.product.count({ where: { area: "BARTENDER" } })],
    ["OperationalReport", 18, () => prisma.operationalReport.count()],
    ["Event", 10, () => prisma.event.count()],
    ["CleaningTask", 10, () => prisma.cleaningTask.count()],
    ["AttendanceRecord", 5, () => prisma.attendanceRecord.count()]
  ];

  for (const [label, expectedMin, countFn] of checks) {
    const count = await countFn();
    if (count < expectedMin) {
      throw new Error(`Validacion seed fallida: ${label} tiene ${count}, esperado minimo ${expectedMin}.`);
    }
  }

  const roomCount = await prisma.room.count();
  if (roomCount !== 50) throw new Error(`Validacion seed fallida: Room debe ser 50 y es ${roomCount}.`);
}

async function printSummary() {
  const [
    users,
    clients,
    rooms,
    reservations,
    activeStays,
    events,
    restaurantOrders,
    barOrders,
    poolEntries,
    cleaningTasks,
    products,
    suppliers,
    purchases,
    reports,
    payments,
    cashMovements,
    attendanceRecords
  ] = await Promise.all([
    prisma.user.count(),
    prisma.client.count(),
    prisma.room.count(),
    prisma.reservation.count(),
    prisma.stay.count({ where: { status: "ACTIVA" } }),
    prisma.event.count(),
    prisma.order.count({ where: { area: "RESTAURANTE" } }),
    prisma.order.count({ where: { area: "BARTENDER" } }),
    prisma.poolEntry.count(),
    prisma.cleaningTask.count(),
    prisma.product.count(),
    prisma.supplier.count(),
    prisma.purchase.count(),
    prisma.operationalReport.count(),
    prisma.payment.count(),
    prisma.cashMovement.count(),
    prisma.attendanceRecord.count()
  ]);

  console.log(`
============================================
HOTEL PARK PLAZA - DEMO DATA CREATED

Users: ${users}
Clients: ${clients}
Rooms: ${rooms}
Reservations: ${reservations}
Active stays: ${activeStays}
Events: ${events}
Restaurant orders: ${restaurantOrders}
Bar orders: ${barOrders}
Pool entries: ${poolEntries}
Cleaning tasks: ${cleaningTasks}
Products: ${products}
Suppliers: ${suppliers}
Purchases: ${purchases}
Reports: ${reports}
Payments: ${payments}
Cash movements: ${cashMovements}
Attendance records: ${attendanceRecords}

Admin:
admin@parkplaza.com

Password:
${password}
============================================
`);
}

async function main() {
  await cleanDevelopmentData();
  await ensureDemoUploads();
  const { users } = await createRolesAndUsers();
  await createSettings();
  const clients = await createClients();
  const { rooms } = await createRooms();
  const { reservations, stays } = await createReservationsAndStays({ clients, rooms });
  const cleaningTasks = await createCleaning({ rooms, users });
  const events = await createEvents({ clients });
  await createParking({ clients });
  const { products } = await createInventoryAndPurchases({ users });
  await createOrdersAndConsumptions({ clients, rooms, stays, products, users });
  await createPool({ clients, reservations, events, users });
  await createOperationalReports({ rooms, products, tasks: cleaningTasks, users });
  await createPaymentsCashAndInvoices({ clients, reservations, stays, events, users });
  await createAttendance({ users });
  await createAuditLogs({ users });
  await validateDemoData();
  await printSummary();
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
