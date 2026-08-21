import * as authService from "../services/auth.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { audit } from "../utils/audit.js";

export const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body.email, req.body.password);
  req.user = { id: result.user.id };
  await audit(req, "AUTH", "LOGIN", `Inicio de sesion ${result.user.email}`);
  res.json(result);
});

export const me = asyncHandler(async (req, res) => {
  res.json({ user: req.user });
});
