import express from "express";
import path from "node:path";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { prisma } from "./config/prisma.js";
import { apiRoutes } from "./routes/index.js";
import { errorHandler } from "./middlewares/errorHandler.js";

const app = express();

app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || env.frontendUrls.includes(origin)) return callback(null, true);
    return callback(new Error("Origen no permitido por CORS."));
  },
  credentials: true
}));
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));
app.use("/uploads", express.static(path.resolve("uploads")));

app.use("/api", apiRoutes);
app.use((req, res) => res.status(404).json({ message: "Ruta no encontrada." }));
app.use(errorHandler);

app.listen(env.port, async () => {
  console.log(`Hotel Park Plaza API running on http://localhost:${env.port}`);
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log("PostgreSQL conectado correctamente.");
  } catch (error) {
    console.error("No fue posible conectar con PostgreSQL. Verifique DATABASE_URL y que PostgreSQL este ejecutandose.");
  }
});
