import * as service from "../services/recipe-admin.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { audit } from "../utils/audit.js";

export const index = asyncHandler(async (req, res) => {
  res.json(await service.listRecipes(req.query));
});

export const store = asyncHandler(async (req, res) => {
  const recipe = await service.createRecipe(req.body);
  await audit(req, "RECETAS", "CREAR", recipe.name);
  res.status(201).json(recipe);
});

export const update = asyncHandler(async (req, res) => {
  const recipe = await service.updateRecipe(Number(req.params.id), req.body);
  await audit(req, "RECETAS", "EDITAR", recipe.name);
  res.json(recipe);
});

export const active = asyncHandler(async (req, res) => {
  const recipe = await service.setRecipeActive(Number(req.params.id), Boolean(req.body.active));
  await audit(req, "RECETAS", recipe.active ? "ACTIVAR" : "DESACTIVAR", recipe.name);
  res.json(recipe);
});
