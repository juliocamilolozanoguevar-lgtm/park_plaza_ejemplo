import { prisma } from "../config/prisma.js";
import { HttpError, notFound } from "../utils/httpError.js";

const maintenanceTypes = new Set(["DANO_EQUIPO", "DANO_INFRAESTRUCTURA", "MANTENIMIENTO"]);

function includeReport() {
  return {
    reportedBy: true,
    assignedTo: true,
    resolvedBy: true,
    room: { include: { type: true } },
    cleaningTask: true,
    product: { include: { category: true } },
    evidences: true
  };
}

function codePrefix(area) {
  return area === "BARTENDER" ? "BAR" : area === "RESTAURANTE" ? "RES" : "LIM";
}

export function listReports(query = {}) {
  const where = {
    area: query.area || undefined,
    type: query.type || undefined,
    priority: query.priority || undefined,
    status: query.status || undefined,
    createdAt: query.from || query.to ? {
      gte: query.from ? new Date(query.from) : undefined,
      lte: query.to ? new Date(query.to) : undefined
    } : undefined
  };
  if (query.search) {
    where.OR = [
      { description: { contains: query.search, mode: "insensitive" } },
      { code: { contains: query.search, mode: "insensitive" } },
      { reportedBy: { firstName: { contains: query.search, mode: "insensitive" } } },
      { reportedBy: { lastName: { contains: query.search, mode: "insensitive" } } },
      { room: { number: { contains: query.search } } }
    ];
  }
  return prisma.operationalReport.findMany({
    where,
    include: includeReport(),
    orderBy: [{ status: "asc" }, { createdAt: "desc" }]
  });
}

export async function reportSummary() {
  const [open, review, resolved, high] = await Promise.all([
    prisma.operationalReport.count({ where: { status: "ABIERTO" } }),
    prisma.operationalReport.count({ where: { status: "EN_REVISION" } }),
    prisma.operationalReport.count({ where: { status: "RESUELTO" } }),
    prisma.operationalReport.count({ where: { priority: { in: ["ALTA", "CRITICA"] }, status: { not: "RESUELTO" } } })
  ]);
  return { open, review, resolved, high };
}

export function listAreaProducts(area) {
  return prisma.product.findMany({
    where: { area, active: true },
    include: { category: true },
    orderBy: { name: "asc" }
  });
}

export async function getReport(id) {
  const report = await prisma.operationalReport.findUnique({ where: { id }, include: includeReport() });
  if (!report) throw notFound("Reporte no encontrado.");
  return report;
}

export async function createReport(data, userId, userRole) {
  const area = data.area || (userRole === "BARTENDER" ? "BARTENDER" : userRole === "RESTAURANTE" ? "RESTAURANTE" : "LIMPIEZA");
  if (!["BARTENDER", "RESTAURANTE", "LIMPIEZA"].includes(area)) throw new HttpError(422, "Area invalida.");
  const count = await prisma.operationalReport.count();
  return prisma.operationalReport.create({
    data: {
      code: `${codePrefix(area)}-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`,
      area,
      type: data.type,
      description: data.description,
      priority: data.priority || "MEDIA",
      status: "ABIERTO",
      requiresMaintenance: maintenanceTypes.has(data.type),
      reportedById: userId,
      roomId: data.roomId ? Number(data.roomId) : null,
      cleaningTaskId: data.cleaningTaskId ? Number(data.cleaningTaskId) : null,
      productId: data.productId ? Number(data.productId) : null,
      evidences: data.files?.length
        ? { create: data.files.map((file) => ({ imageUrl: file.imageUrl, fileName: file.fileName, mimeType: file.mimeType, size: file.size })) }
        : undefined
    },
    include: includeReport()
  });
}

export async function updateReportStatus(id, status, userId, payload = {}) {
  if (!["ABIERTO", "EN_REVISION", "RESUELTO"].includes(status)) throw new HttpError(422, "Estado invalido.");
  const report = await getReport(id);
  if (status === "EN_REVISION" && report.status !== "ABIERTO") {
    throw new HttpError(422, "Este trabajo ya fue iniciado o finalizado.");
  }
  if (status === "RESUELTO" && report.status !== "EN_REVISION") {
    throw new HttpError(422, "Solo se puede finalizar un trabajo en reparacion.");
  }
  if (status === "RESUELTO" && !payload.workDescription?.trim()) {
    throw new HttpError(422, "Describe el trabajo realizado antes de finalizar.");
  }
  return prisma.operationalReport.update({
    where: { id },
    data: {
      status,
      assignedToId: status === "EN_REVISION" && !report.assignedToId ? userId : undefined,
      startedAt: status === "EN_REVISION" && !report.startedAt ? new Date() : undefined,
      resolvedAt: status === "RESUELTO" ? new Date() : null,
      resolvedById: status === "RESUELTO" ? userId : null,
      workDescription: status === "RESUELTO" ? payload.workDescription.trim() : undefined,
      observations: status === "RESUELTO" ? payload.observations?.trim() || null : undefined
    },
    include: includeReport()
  });
}

export async function addReportEvidence(id, files = []) {
  await getReport(id);
  if (!files.length) return [];
  return prisma.operationalReportEvidence.createManyAndReturn({
    data: files.map((file) => ({
      reportId: id,
      imageUrl: file.imageUrl,
      fileName: file.fileName || null,
      mimeType: file.mimeType || null,
      size: file.size || null
    }))
  });
}
