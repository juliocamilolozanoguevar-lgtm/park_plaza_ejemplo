const baseUrl = "http://localhost:3000/api";

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.message || response.statusText);
    error.status = response.status;
    throw error;
  }
  return data;
}

const adminLogin = await request("/auth/login", {
  method: "POST",
  body: { email: "admin@parkplaza.com", password: "ParkPlaza123*" }
});
const adminHeaders = { Authorization: `Bearer ${adminLogin.token}` };

const cleaningLogin = await request("/auth/login", {
  method: "POST",
  body: { email: "limpieza@parkplaza.com", password: "ParkPlaza123*" }
});
const cleaningHeaders = { Authorization: `Bearer ${cleaningLogin.token}` };

const tasks = await request("/cleaning/tasks", { headers: cleaningHeaders });
const task = tasks.find((item) => item.status !== "FINALIZADA") || tasks[0];
if (!task) throw new Error("No hay tareas de limpieza para probar.");

const started = await request(`/cleaning/tasks/${task.id}/start`, {
  method: "PATCH",
  headers: cleaningHeaders
});
const evidence = await request(`/cleaning/tasks/${task.id}/evidence`, {
  method: "POST",
  headers: cleaningHeaders,
  body: {
    description: "Smoke evidencia",
    files: [{ imageUrl: "/uploads/cleaning/smoke.webp", fileName: "smoke.webp", mimeType: "image/webp", size: 10 }]
  }
});
const report = await request(`/cleaning/tasks/${task.id}/report`, {
  method: "POST",
  headers: cleaningHeaders,
  body: {
    type: "DANO_INFRAESTRUCTURA",
    priority: "ALTA",
    description: "Smoke vidrio roto",
    files: [{ imageUrl: "/uploads/cleaning/smoke-report.webp", fileName: "smoke-report.webp", mimeType: "image/webp", size: 11 }]
  }
});
const finished = await request(`/cleaning/tasks/${task.id}/finish`, {
  method: "PATCH",
  headers: cleaningHeaders
});
const reports = await request("/reports?area=LIMPIEZA", { headers: adminHeaders });
const review = await request(`/reports/${report.id}/status`, {
  method: "PATCH",
  headers: adminHeaders,
  body: { status: "EN_REVISION" }
});
const resolved = await request(`/reports/${report.id}/status`, {
  method: "PATCH",
  headers: adminHeaders,
  body: { status: "RESUELTO" }
});

const bartenderLogin = await request("/auth/login", {
  method: "POST",
  body: { email: "bartender@parkplaza.com", password: "ParkPlaza123*" }
});
const bartenderHeaders = { Authorization: `Bearer ${bartenderLogin.token}` };
const barProducts = await request("/reports/products?area=BARTENDER", { headers: bartenderHeaders });
const barReport = await request("/reports", {
  method: "POST",
  headers: bartenderHeaders,
  body: { area: "BARTENDER", type: "FALTA_INSUMO", priority: "MEDIA", productId: barProducts[0]?.id, description: "Smoke falta de insumo" }
});

console.log(JSON.stringify({
  taskId: task.id,
  started: started.status,
  evidenceCount: evidence.length,
  cleaningReport: report.code,
  finished: finished.status,
  adminReports: reports.reports.length,
  review: review.status,
  resolved: resolved.status,
  bartenderProducts: barProducts.length,
  bartenderReport: barReport.code
}, null, 2));
