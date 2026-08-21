import * as service from "../services/report.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { audit } from "../utils/audit.js";

export const index = asyncHandler(async (req, res) => {
  const [reports, summary] = await Promise.all([
    service.listReports(req.query),
    service.reportSummary()
  ]);
  res.json({ reports, summary });
});

export const show = asyncHandler(async (req, res) => {
  res.json(await service.getReport(Number(req.params.id)));
});

export const products = asyncHandler(async (req, res) => {
  res.json(await service.listAreaProducts(req.query.area));
});

export const store = asyncHandler(async (req, res) => {
  const report = await service.createReport(req.body, req.user?.id, req.user?.role);
  await audit(req, "REPORTES", "CREAR", report.code);
  res.status(201).json(report);
});

export const status = asyncHandler(async (req, res) => {
  const report = await service.updateReportStatus(Number(req.params.id), req.body.status, req.user?.id, req.body);
  await audit(req, "REPORTES", "CAMBIAR_ESTADO", `${report.code} -> ${report.status}`);
  res.json(report);
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

export const evidence = asyncHandler(async (req, res) => {
  const evidenceRows = await service.addReportEvidence(Number(req.params.id), req.body.files || []);
  await audit(req, "REPORTES", "EVIDENCIA", `Reporte ${req.params.id}`);
  res.status(201).json(evidenceRows);
});
