const BASE_URL = process.env.API_URL || "http://localhost:3000/api";
const PASSWORD = process.env.SMOKE_PASSWORD || "ParkPlaza123*";

const scenario = {
  adminEmail: "admin@parkplaza.com",
  roleName: "LIMPIEZA",
  workerEmail: "limpieza@parkplaza.com",
  permission: "LIMPIEZA:VER",
  protectedPath: "/cleaning/tasks"
};

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
  if (response.status !== 200) throw new Error(`Login fallo para ${email}: ${response.status}`);
  return response.data.token;
}

function permissionKey(permission) {
  return `${permission.module}:${permission.action}`;
}

async function setRolePermissions(adminToken, roleId, permissionIds) {
  const response = await request(`/roles/${roleId}/permissions`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { permissionIds }
  });
  if (response.status !== 200) throw new Error(`No se pudo actualizar permisos: ${response.status}`);
}

async function assertStatus(token, path, expected, label) {
  const response = await request(path, { headers: { Authorization: `Bearer ${token}` } });
  if (response.status !== expected) throw new Error(`${label}: esperado ${expected}, recibido ${response.status}`);
}

async function run() {
  const adminToken = await login(scenario.adminEmail);
  const rolesResponse = await request("/roles", { headers: { Authorization: `Bearer ${adminToken}` } });
  const permissionsResponse = await request("/roles/permissions", { headers: { Authorization: `Bearer ${adminToken}` } });
  if (rolesResponse.status !== 200 || permissionsResponse.status !== 200) {
    throw new Error("No se pudo leer roles/permisos como administrador.");
  }

  const role = rolesResponse.data.find((item) => item.name === scenario.roleName);
  const targetPermission = permissionsResponse.data.find((item) => permissionKey(item) === scenario.permission);
  if (!role || !targetPermission) throw new Error("No se encontro rol o permiso del escenario.");

  const originalIds = role.permissions.map((item) => item.permissionId);
  const withoutTarget = originalIds.filter((id) => id !== targetPermission.id);

  try {
    await setRolePermissions(adminToken, role.id, withoutTarget);
    const blockedToken = await login(scenario.workerEmail);
    await assertStatus(blockedToken, scenario.protectedPath, 403, "Permiso desactivado");

    await setRolePermissions(adminToken, role.id, originalIds);
    const restoredToken = await login(scenario.workerEmail);
    await assertStatus(restoredToken, scenario.protectedPath, 200, "Permiso restaurado");
  } finally {
    await setRolePermissions(adminToken, role.id, originalIds);
  }

  console.log(`Toggle permisos completado: ${scenario.roleName} ${scenario.permission}`);
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
