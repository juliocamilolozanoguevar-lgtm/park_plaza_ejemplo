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

const login = await request("/auth/login", {
  method: "POST",
  body: { email: "admin@parkplaza.com", password: "ParkPlaza123*" }
});
const headers = { Authorization: `Bearer ${login.token}` };

const clients = await request("/clients/search?q=70000001", { headers });
const spaces = await request("/events/spaces", { headers });
const client = clients[0];
const space = spaces[0];

const startsAt = "2026-12-21T18:00:00";
const endsAt = "2026-12-21T20:00:00";
const created = await request("/events", {
  method: "POST",
  headers,
  body: {
    clientId: client.id,
    spaceId: space.id,
    name: "Smoke Evento",
    type: "Corporativo",
    startsAt,
    endsAt,
    guests: 10,
    price: 500,
    advance: 50,
    status: "RESERVADO",
    notes: "Smoke test"
  }
});

let conflictStatus = "NO";
try {
  await request("/events", {
    method: "POST",
    headers,
    body: {
      clientId: client.id,
      spaceId: space.id,
      name: "Smoke Conflicto",
      type: "Corporativo",
      startsAt: "2026-12-21T19:00:00",
      endsAt: "2026-12-21T21:00:00",
      guests: 10,
      price: 500,
      advance: 0,
      status: "RESERVADO"
    }
  });
} catch (error) {
  conflictStatus = error.status;
}

const paid = await request(`/events/${created.id}/payments`, {
  method: "POST",
  headers,
  body: { amount: 25, method: "EFECTIVO", reference: "SMOKE" }
});
const canceled = await request(`/events/${created.id}/status`, {
  method: "PATCH",
  headers,
  body: { status: "CANCELADO" }
});

const products = await request("/inventory?area=RESTAURANTE", { headers });
const product = products[0];
await request("/inventory/entries", {
  method: "POST",
  headers,
  body: { productId: product.id, quantity: 1, reason: "Smoke entrada", reference: "SMOKE" }
});
await request("/inventory/exits", {
  method: "POST",
  headers,
  body: { productId: product.id, quantity: 1, reason: "Smoke salida", reference: "SMOKE" }
});
const movements = await request(`/inventory/movements?area=RESTAURANTE&productId=${product.id}`, { headers });

console.log(JSON.stringify({
  clientSearch: clients.length > 0,
  spaces: spaces.length,
  createdEvent: created.id,
  conflictStatus,
  paidBalance: paid.balance,
  canceledStatus: canceled.status,
  inventoryProducts: products.length,
  kardexMoves: movements.length
}, null, 2));
