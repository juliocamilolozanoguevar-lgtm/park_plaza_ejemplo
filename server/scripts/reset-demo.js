import { execFileSync } from "node:child_process";

if (process.env.NODE_ENV === "production") {
  console.error("db:reset-demo bloqueado: no se permite ejecutar en NODE_ENV=production.");
  process.exit(1);
}

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

execFileSync(npx, ["prisma", "db", "push", "--accept-data-loss"], {
  cwd: "server",
  stdio: "inherit"
});

execFileSync(npm, ["run", "prisma:seed", "--workspace", "server"], {
  stdio: "inherit"
});
