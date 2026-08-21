import { prisma } from "../config/prisma.js";
import { HttpError, notFound } from "../utils/httpError.js";

const REQUIRE_EVIDENCE_TO_FINISH = false;
const maintenanceTypes = new Set(["DANO_EQUIPO", "DANO_INFRAESTRUCTURA", "MANTENIMIENTO"]);

export function listCleaningTasks(query = {}) {
  return prisma.cleaningTask.findMany({
    where: { status: query.status || undefined },
    include: {
      room: { include: { type: true } },
      evidences: { include: { createdBy: true }, orderBy: { createdAt: "desc" } },
      reports: true,
      operationalReports: { include: { evidences: true, reportedBy: true }, orderBy: { createdAt: "desc" } }
    },
    orderBy: [{ status: "asc" }, { id: "desc" }]
  });
}

export async function updateCleaningTask(id, data, userId) {
  const task = await prisma.cleaningTask.findUnique({ where: { id } });
  if (!task) throw notFound("Tarea de limpieza no encontrada.");
  if ((data.status || task.status) === "FINALIZADA" && REQUIRE_EVIDENCE_TO_FINISH) {
    const evidenceCount = await prisma.cleaningEvidence.count({ where: { taskId: id } });
    if (evidenceCount === 0) throw new HttpError(422, "Se requiere al menos una evidencia para finalizar la limpieza.");
  }

  return prisma.$transaction(async (tx) => {
    const nextStatus = data.status || task.status;
    const updated = await tx.cleaningTask.update({
      where: { id },
      data: {
        status: nextStatus,
        assignedTo: data.assignedTo ?? task.assignedTo,
        assignedToId: data.assignedToId ?? undefined,
        startedAt: nextStatus === "EN_LIMPIEZA" && !task.startedAt ? new Date() : undefined,
        finishedAt: nextStatus === "FINALIZADA" ? new Date() : undefined,
        finishedById: nextStatus === "FINALIZADA" ? userId : undefined,
        bathroom: data.bathroom ?? undefined,
        bed: data.bed ?? undefined,
        floor: data.floor ?? undefined,
        surfaces: data.surfaces ?? undefined,
        amenities: data.amenities ?? undefined,
        minibar: data.minibar ?? undefined,
        finalCheck: data.finalCheck ?? undefined
      },
      include: { room: { include: { type: true } }, evidences: true, reports: true, operationalReports: { include: { evidences: true } } }
    });

    if (nextStatus === "FINALIZADA") {
      await tx.room.update({ where: { id: updated.roomId }, data: { status: "LIBRE" } });
    } else if (nextStatus === "EN_LIMPIEZA") {
      await tx.room.update({ where: { id: updated.roomId }, data: { status: "EN_LIMPIEZA" } });
    }

    return updated;
  });
}

export function listCleaningReports() {
  return prisma.cleaningReport.findMany({
    include: { room: true, cleaningTask: true, reportedBy: true },
    orderBy: { createdAt: "desc" }
  });
}

export function createCleaningReport(data, userId) {
  return prisma.cleaningReport.create({
    data: {
      roomId: Number(data.roomId),
      cleaningTaskId: data.cleaningTaskId ? Number(data.cleaningTaskId) : null,
      type: data.type,
      description: data.description,
      priority: data.priority || "MEDIA",
      reportedById: userId
    },
    include: { room: true, cleaningTask: true }
  });
}

export async function createCleaningEvidence(taskId, data, userId) {
  const task = await prisma.cleaningTask.findUnique({ where: { id: taskId } });
  if (!task) throw notFound("Tarea de limpieza no encontrada.");

  const files = data.files?.length ? data.files : [{ imageUrl: data.fileUrl || data.imageUrl || "evidencia-local" }];
  return prisma.cleaningEvidence.createManyAndReturn({
    data: files.map((file) => ({
      taskId,
      roomId: task.roomId,
      fileUrl: file.imageUrl,
      imageUrl: file.imageUrl,
      fileName: file.fileName || null,
      mimeType: file.mimeType || null,
      size: file.size || null,
      description: data.description || data.notes || null,
      notes: data.description || data.notes || null,
      createdById: userId
    }))
  });
}

export async function createTaskReport(taskId, data, userId) {
  const task = await prisma.cleaningTask.findUnique({ where: { id: taskId }, include: { room: true } });
  if (!task) throw notFound("Tarea de limpieza no encontrada.");
  const count = await prisma.operationalReport.count();
  const report = await prisma.operationalReport.create({
    data: {
      code: `RPT-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`,
      area: "LIMPIEZA",
      type: data.type,
      description: data.description,
      priority: data.priority || "MEDIA",
      status: "ABIERTO",
      requiresMaintenance: maintenanceTypes.has(data.type),
      reportedById: userId,
      roomId: task.roomId,
      cleaningTaskId: taskId,
      evidences: data.files?.length
        ? {
            create: data.files.map((file) => ({
              imageUrl: file.imageUrl,
              fileName: file.fileName || null,
              mimeType: file.mimeType || null,
              size: file.size || null
            }))
          }
        : undefined
    },
    include: { room: true, cleaningTask: true, reportedBy: true, evidences: true }
  });
  return report;
}
