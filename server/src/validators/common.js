import { z } from "zod";
import { HttpError } from "../utils/httpError.js";

export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse({
      body: req.body,
      params: req.params,
      query: req.query
    });

    if (!result.success) {
      return next(new HttpError(422, "Datos invalidos.", result.error.flatten()));
    }

    req.validated = result.data;
    next();
  };
}

export const idParamSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive()
  })
});
