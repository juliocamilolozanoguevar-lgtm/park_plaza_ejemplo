import dotenv from "dotenv";

dotenv.config();

function buildDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT || "5432";
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const name = process.env.DB_NAME;

  if (!host || !user || !password || !name) return undefined;

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${name}?schema=public`;
}

const databaseUrl = buildDatabaseUrl();
if (databaseUrl) {
  process.env.DATABASE_URL = databaseUrl;
}

export const env = {
  port: Number(process.env.PORT || 3000),
  jwtSecret: process.env.JWT_SECRET || "development_secret_change_me",
  databaseUrl,
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  frontendUrls: (process.env.FRONTEND_URL || "http://localhost:5173,http://localhost:5500,http://localhost:8000")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean),
  nodeEnv: process.env.NODE_ENV || "development",
  customerDevOtp: process.env.CUSTOMER_DEV_OTP || "123456",
  otpProviderConfigured: Boolean(process.env.OTP_PROVIDER_URL && process.env.OTP_PROVIDER_KEY)
};
