import { prisma } from "../config/prisma.js";
import { HttpError, notFound } from "../utils/httpError.js";

const MARK_COOLDOWN_MS = 60 * 1000;

function startOfDay(date = new Date()) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfDay(date = new Date()) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

function minutesBetween(start, end) {
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));
}

function userWhere(search) {
  const value = String(search || "").trim();
  if (!value) return undefined;
  return {
    OR: [
      { firstName: { contains: value, mode: "insensitive" } },
      { lastName: { contains: value, mode: "insensitive" } },
      { email: { contains: value, mode: "insensitive" } },
      { documentNumber: { contains: value, mode: "insensitive" } },
      { username: { contains: value, mode: "insensitive" } }
    ]
  };
}

function buildWhere(query = {}, todayOnly = false) {
  const where = {};
  const and = [];
  if (todayOnly) {
    where.checkInAt = { gte: startOfDay(), lte: endOfDay() };
  } else {
    if (query.from || query.to) {
      where.checkInAt = {};
      if (query.from) where.checkInAt.gte = startOfDay(new Date(query.from));
      if (query.to) where.checkInAt.lte = endOfDay(new Date(query.to));
    }
  }
  if (query.status && query.status !== "TODOS") where.status = query.status;
  if (query.area && query.area !== "TODOS") and.push({ user: { role: { name: query.area } } });
  const searchWhere = userWhere(query.search);
  if (searchWhere) and.push({ user: searchWhere });
  if (and.length) where.AND = and;
  return where;
}

export function serialize(record) {
  return {
    ...record,
    worker: record.user,
    user: record.user
  };
}

export async function summary() {
  const todayWhere = { checkInAt: { gte: startOfDay(), lte: endOfDay() } };
  const [activeWorkers, present, finalized, review, todayRecords, recent] = await Promise.all([
    prisma.user.count({ where: { status: "ACTIVO" } }),
    prisma.attendanceRecord.count({ where: { ...todayWhere, status: "PRESENTE" } }),
    prisma.attendanceRecord.count({ where: { ...todayWhere, status: "FINALIZADA" } }),
    prisma.attendanceRecord.count({ where: { status: "REQUIERE_REVISION" } }),
    prisma.attendanceRecord.count({ where: todayWhere }),
    prisma.attendanceRecord.findMany({ include: includeUser(), orderBy: { checkInAt: "desc" }, take: 8 })
  ]);
  return {
    activeWorkers,
    present,
    todayEntries: todayRecords,
    exits: finalized,
    openShifts: present,
    reviewRequired: review,
    recent: recent.map(serialize)
  };
}

export async function today(query = {}) {
  const records = await prisma.attendanceRecord.findMany({
    where: buildWhere(query, true),
    include: includeUser(),
    orderBy: [{ status: "asc" }, { checkInAt: "desc" }]
  });
  return records.map(serialize);
}

export async function history(query = {}) {
  const records = await prisma.attendanceRecord.findMany({
    where: buildWhere(query, false),
    include: includeUser(),
    orderBy: { checkInAt: "desc" },
    take: Number(query.take || 200)
  });
  return records.map(serialize);
}

export async function getRecord(id) {
  const record = await prisma.attendanceRecord.findUnique({ where: { id }, include: includeUser() });
  if (!record) throw notFound("Registro de asistencia no encontrado.");
  return serialize(record);
}

export async function mark(identifier) {
  const value = String(identifier || "").trim();
  if (!value) throw new HttpError(422, "Ingresa DNI, codigo o usuario.");
  const worker = await prisma.user.findFirst({
    where: {
      OR: [
        { documentNumber: value },
        { username: value },
        { email: value }
      ]
    },
    include: { role: true }
  });
  if (!worker) throw notFound("Trabajador no encontrado.");
  if (worker.status !== "ACTIVO") throw new HttpError(403, "El trabajador no esta activo para marcar asistencia.");

  const open = await prisma.attendanceRecord.findFirst({
    where: { userId: worker.id, checkOutAt: null, status: "PRESENTE" },
    orderBy: { checkInAt: "desc" },
    include: includeUser()
  });

  const now = new Date();
  if (!open) {
    const created = await prisma.attendanceRecord.create({ data: { userId: worker.id, checkInAt: now }, include: includeUser() });
    return { type: "ENTRADA", record: serialize(created) };
  }

  if (open.checkInAt < startOfDay(now)) {
    const flagged = await prisma.attendanceRecord.update({
      where: { id: open.id },
      data: { status: "REQUIERE_REVISION", reviewReason: "Jornada anterior abierta. Requiere revision administrativa." },
      include: includeUser()
    });
    return { type: "REVISION", record: serialize(flagged), message: "Existe una jornada anterior abierta. Administracion debe revisarla." };
  }

  if (now.getTime() - open.checkInAt.getTime() < MARK_COOLDOWN_MS) {
    throw new HttpError(429, "Marcacion ya registrada. Espere antes de volver a intentar.");
  }

  const finished = await prisma.attendanceRecord.update({
    where: { id: open.id },
    data: { checkOutAt: now, durationMinutes: minutesBetween(open.checkInAt, now), status: "FINALIZADA" },
    include: includeUser()
  });
  return { type: "SALIDA", record: serialize(finished) };
}

export async function correct(id, data, adminId) {
  const current = await prisma.attendanceRecord.findUnique({ where: { id }, include: includeUser() });
  if (!current) throw notFound("Registro de asistencia no encontrado.");
  const reason = String(data.reason || "").trim();
  if (!reason) throw new HttpError(422, "El motivo de correccion es obligatorio.");
  const checkInAt = data.checkInAt ? new Date(data.checkInAt) : current.checkInAt;
  const checkOutAt = data.checkOutAt ? new Date(data.checkOutAt) : (data.checkOutAt === null ? null : current.checkOutAt);
  const status = data.status || (checkOutAt ? "FINALIZADA" : current.status);
  const updated = await prisma.attendanceRecord.update({
    where: { id },
    data: {
      checkInAt,
      checkOutAt,
      durationMinutes: checkOutAt ? minutesBetween(checkInAt, checkOutAt) : null,
      status,
      reviewReason: data.reviewReason ?? current.reviewReason,
      correctionReason: reason,
      correctedById: adminId
    },
    include: includeUser()
  });
  return { previous: serialize(current), current: serialize(updated) };
}

function includeUser() {
  return {
    user: {
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        documentNumber: true,
        phone: true,
        birthDate: true,
        photoUrl: true,
        position: true,
        hireDate: true,
        username: true,
        status: true,
        roleId: true,
        createdAt: true,
        updatedAt: true,
        role: true
      }
    },
    correctedBy: { select: { id: true, firstName: true, lastName: true, email: true } }
  };
}
