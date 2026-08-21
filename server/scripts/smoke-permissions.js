const BASE_URL = process.env.API_URL || "http://localhost:3000/api";
const PASSWORD = process.env.SMOKE_PASSWORD || "ParkPlaza123*";

const users = [
  ["admin@parkplaza.com", "ADMINISTRADOR"],
  ["recepcion@parkplaza.com", "RECEPCIONISTA"],
  ["limpieza@parkplaza.com", "LIMPIEZA"],
  ["restaurante@parkplaza.com", "RESTAURANTE"],
  ["bartender@parkplaza.com", "BARTENDER"],
  ["piscina@parkplaza.com", "PISCINA"],
  ["mantenimiento@parkplaza.com", "MANTENIMIENTO"]
];

const permissionChecks = [
  ["/usuarios", ["USUARIOS:VER"]],
  ["/roles", ["ROLES:VER"]],
  ["/inventory", ["INVENTARIO:VER"]],
  ["/reservations", ["RESERVAS:VER"]],
  ["/clientes", ["CLIENTES:VER"]],
  ["/checkin/search", ["CHECK_IN:VER"]],
  ["/checkout/stays", ["CHECK_OUT:VER"]],
  ["/cleaning/tasks", ["LIMPIEZA:VER"]],
  ["/restaurante", ["RESTAURANTE:VER"]],
  ["/bartender", ["BARTENDER:VER"]],
  ["/pool", ["PISCINA:VER"]],
  ["/reports", ["REPORTES:VER", "LIMPIEZA:VER", "RESTAURANTE:VER", "BARTENDER:VER", "MANTENIMIENTO:VER"]]
];

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await response.json().catch(() => null);
  return { status: response.status, data };
}

async function login(email) {
  const response = await request("/auth/login", {
    method: "POST",
    body: { email, password: PASSWORD }
  });
  if (response.status !== 200) {
    throw new Error(`Login fallo para ${email}: ${response.status} ${response.data?.message || ""}`);
  }
  return response.data.token;
}

async function assertStatus(token, path, expected, label) {
  const response = await request(path, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const ok = Array.isArray(expected) ? expected.includes(response.status) : response.status === expected;
  if (!ok) {
    throw new Error(`${label} ${path}: esperado ${expected}, recibido ${response.status}`);
  }
  return response.status;
}

async function run() {
  const summary = [];
  for (const [email, role] of users) {
    const token = await login(email);
    const me = await request("/auth/me", { headers: { Authorization: `Bearer ${token}` } });
    if (me.status !== 200 || me.data?.user?.role !== role) {
      throw new Error(`/auth/me no devolvio rol ${role} para ${email}`);
    }

    const permissions = new Set(me.data.user.permissions || []);
    for (const [path, required] of permissionChecks) {
      const allowed = role === "ADMINISTRADOR" || required.some((permission) => permissions.has(permission));
      await assertStatus(token, path, allowed ? 200 : 403, `${email} ${allowed ? "permitido" : "bloqueado"}`);
    }

    summary.push(`${role}: OK`);
  }

  console.log("Smoke permisos completado:");
  for (const line of summary) console.log(`- ${line}`);
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
