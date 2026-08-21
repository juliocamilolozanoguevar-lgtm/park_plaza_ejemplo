const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const passwordlessProfiles = {
  "admin@parkplaza.com": ["10000001", "Administrador", "admin.general", "/assets/park-plaza-logo.png"],
  "recepcion@parkplaza.com": ["70000012", "Recepcionista", "maria.lopez", null],
  "restaurante@parkplaza.com": ["12345678", "Mesero", "carlos.ruiz", null],
  "bartender@parkplaza.com": ["87654321", "Bartender", "luis.gomez", null],
  "piscina@parkplaza.com": ["23456789", "Operador de piscina", "ana.torres", null],
  "limpieza@parkplaza.com": ["34567890", "Auxiliar de limpieza", "lidia.ramos", null],
  "mantenimiento@parkplaza.com": ["45678901", "Tecnico de mantenimiento", "juan.perez", null]
};

function day(offset, hour, minute) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  date.setHours(hour, minute, 0, 0);
  return date;
}

async function main() {
  const actions = ["VER", "CREAR", "EDITAR", "ELIMINAR"];
  const permissions = [];
  for (const action of actions) {
    permissions.push(await prisma.permission.upsert({
      where: { module_action: { module: "ASISTENCIA", action } },
      update: {},
      create: { module: "ASISTENCIA", action }
    }));
  }

  const adminRole = await prisma.role.findUnique({ where: { name: "ADMINISTRADOR" } });
  if (adminRole) {
    for (const permission of permissions) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: adminRole.id, permissionId: permission.id } },
        update: {},
        create: { roleId: adminRole.id, permissionId: permission.id }
      });
    }
  }

  const maintenanceRole = await prisma.role.findUnique({ where: { name: "MANTENIMIENTO" } });
  const viewPermission = permissions.find((permission) => permission.action === "VER");
  if (maintenanceRole && viewPermission) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: maintenanceRole.id, permissionId: viewPermission.id } },
      update: {},
      create: { roleId: maintenanceRole.id, permissionId: viewPermission.id }
    });
  }

  const users = {};
  for (const [email, [documentNumber, position, username, photoUrl]] of Object.entries(passwordlessProfiles)) {
    const existing = await prisma.user.findUnique({ where: { email }, include: { role: true } });
    if (!existing) continue;
    users[existing.role.name] = await prisma.user.update({
      where: { id: existing.id },
      data: {
        documentNumber: existing.documentNumber || documentNumber,
        position: existing.position || position,
        username: existing.username || username,
        photoUrl: existing.photoUrl || photoUrl,
        hireDate: existing.hireDate || day(-90, 8, 0)
      },
      include: { role: true }
    });
  }

  const count = await prisma.attendanceRecord.count();
  if (count === 0) {
    const rows = [
      users.RECEPCIONISTA && { userId: users.RECEPCIONISTA.id, checkInAt: day(0, 7, 30), status: "PRESENTE" },
      users.RESTAURANTE && { userId: users.RESTAURANTE.id, checkInAt: day(0, 8, 3), checkOutAt: day(0, 17, 12), durationMinutes: 549, status: "FINALIZADA" },
      users.BARTENDER && { userId: users.BARTENDER.id, checkInAt: day(0, 8, 10), status: "PRESENTE" },
      users.LIMPIEZA && { userId: users.LIMPIEZA.id, checkInAt: day(0, 8, 15), status: "PRESENTE" },
      users.MANTENIMIENTO && { userId: users.MANTENIMIENTO.id, checkInAt: day(0, 7, 58), checkOutAt: day(0, 17, 20), durationMinutes: 562, status: "FINALIZADA" },
      users.PISCINA && { userId: users.PISCINA.id, checkInAt: day(-1, 8, 0), status: "REQUIERE_REVISION", reviewReason: "Jornada anterior abierta detectada en prueba." }
    ].filter(Boolean);
    if (rows.length) await prisma.attendanceRecord.createMany({ data: rows });
  }

  console.log("Asistencia finalizada: permisos, perfiles y datos demo verificados.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
