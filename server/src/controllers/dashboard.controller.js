import * as dashboardService from "../services/dashboard.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const dashboard = asyncHandler(async (req, res) => {
  res.json(await dashboardService.getDashboard());
});
