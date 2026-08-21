import * as service from "../services/cleaning.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { audit } from "../utils/audit.js";

export const index = asyncHandler(async (req, res) => {
  res.json(await service.listCleaningTasks(req.query));
});

export const update = asyncHandler(async (req, res) => {
  const task = await service.updateCleaningTask(Number(req.params.id), req.body, req.user?.id);
  await audit(req, "LIMPIEZA", "ACTUALIZAR", `Habitacion ${task.room.number} -> ${task.status}`);
  res.json(task);
});

export const start = asyncHandler(async (req, res) => {
  const task = await service.updateCleaningTask(Number(req.params.id), { status: "EN_LIMPIEZA", assignedTo: `${req.user.firstName} ${req.user.lastName}`, assignedToId: req.user.id }, req.user?.id);
  await audit(req, "LIMPIEZA", "INICIAR", `Habitacion ${task.room.number}`);
  res.json(task);
});

export const finish = asyncHandler(async (req, res) => {
  const task = await service.updateCleaningTask(Number(req.params.id), { status: "FINALIZADA", finalCheck: true }, req.user?.id);
  await audit(req, "LIMPIEZA", "FINALIZAR", `Habitacion ${task.room.number}`);
  res.json(task);
});

export const reports = asyncHandler(async (req, res) => {
  res.json(await service.listCleaningReports());
});

export const storeReport = asyncHandler(async (req, res) => {
  const report = await service.createCleaningReport(req.body, req.user?.id);
  await audit(req, "LIMPIEZA", "REPORTE", report.description);
  res.status(201).json(report);
});

export const storeEvidence = asyncHandler(async (req, res) => {
  const evidence = await service.createCleaningEvidence(Number(req.params.id), req.body, req.user?.id);
  await audit(req, "LIMPIEZA", "EVIDENCIA", `Tarea ${req.params.id}`);
  res.status(201).json(evidence);
});

export const storeTaskReport = asyncHandler(async (req, res) => {
  const report = await service.createTaskReport(Number(req.params.id), req.body, req.user?.id);
  await audit(req, "LIMPIEZA", "REPORTE_OPERATIVO", report.code);
  res.status(201).json(report);
});

export const uploadEvidence = asyncHandler(async (req, res) => {
  const files = (req.files || []).map((file) => ({
    imageUrl: `/uploads/cleaning/${file.filename}`,
    fileName: file.originalname,
    mimeType: file.mimetype,
    size: file.size
  }));
  res.status(201).json({ files });
});
