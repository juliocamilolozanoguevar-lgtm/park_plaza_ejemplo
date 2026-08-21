import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { HttpError } from "../utils/httpError.js";

const uploadRoot = path.resolve("uploads", "cleaning");
fs.mkdirSync(uploadRoot, { recursive: true });

const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);

const storage = multer.diskStorage({
  destination: uploadRoot,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, safeName);
  }
});

export const cleaningUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 8 },
  fileFilter: (_req, file, cb) => {
    if (!allowed.has(file.mimetype)) {
      cb(new HttpError(422, "Solo se permiten imagenes JPG, PNG o WEBP."));
      return;
    }
    cb(null, true);
  }
});
