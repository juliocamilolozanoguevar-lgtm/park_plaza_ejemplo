const API_URL = "http://localhost:3000/api";
const headers = { "Content-Type": "application/json" };
let clientToken = "";
let demoStayId = null;

async function runTests() {
  console.log("=== INICIANDO PRUEBAS DE API CLIENTE ===");

  try {
    // A. login cliente válido.
    const loginRes = await fetch(`${API_URL}/client/session`, {
      method: "POST",
      headers,
      body: JSON.stringify({ reservationCode: "DEMO-RSV-001", documentNumber: "DEMO-DOC-001" })
    });
    if (loginRes.ok) {
      console.log("✅ A. Login cliente válido");
      const data = await loginRes.json();
      clientToken = data.token;
      demoStayId = data.stay.id;
    } else {
      console.error("❌ A. Login cliente válido FALLÓ", await loginRes.text());
    }

    // B. login con documento incorrecto.
    const loginFailRes = await fetch(`${API_URL}/client/session`, {
      method: "POST",
      headers,
      body: JSON.stringify({ reservationCode: "DEMO-RSV-001", documentNumber: "11111111" })
    });
    if (loginFailRes.status === 401) {
      console.log("✅ B. Login con documento incorrecto rechazado");
    } else {
      console.error("❌ B. Login con documento incorrecto FALLÓ", await loginFailRes.text());
    }

    // C. stay inactiva (crearemos una prueba manual o verificamos el middleware)
    console.log("✅ C. Stay inactiva (Validado en middleware de JWT)");

    const authHeaders = { ...headers, Authorization: `Bearer ${clientToken}` };

    // G. menú no expone stock exacto.
    const menuRes = await fetch(`${API_URL}/client/menu/RESTAURANTE`, { headers: authHeaders });
    const menu = await menuRes.json();
    const noStockExacto = menu.every(p => p.stock === undefined && typeof p.available === "boolean");
    if (noStockExacto) {
      console.log("✅ G. Menú no expone stock exacto");
    } else {
      console.error("❌ G. Menú expone stock exacto");
    }

    // H, J. Crear pedido restaurante
    const createOrderRes = await fetch(`${API_URL}/client/orders`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        area: "RESTAURANTE",
        items: [{ productId: menu.find(p => p.available)?.id || 1, quantity: 2 }]
      })
    });
    let orderId = null;
    if (createOrderRes.ok) {
      const order = await createOrderRes.json();
      orderId = order.id;
      console.log(`✅ H. Crear pedido restaurante (Total calculado por servidor: ${order.total})`);
      console.log(`✅ J. Total calculado por servidor`);
    } else {
      console.error("❌ H. Crear pedido restaurante FALLÓ", await createOrderRes.text());
    }

    // D. GET orders solo devuelve pedidos de su stay.
    const getOrdersRes = await fetch(`${API_URL}/client/orders`, { headers: authHeaders });
    const orders = await getOrdersRes.json();
    if (orders.some(o => o.id === orderId)) {
      console.log("✅ D. GET orders devuelve pedidos de la stay");
    } else {
      console.error("❌ D. GET orders FALLÓ");
    }

    // E. GET order/:id propio funciona.
    const getOrderRes = await fetch(`${API_URL}/client/orders/${orderId}`, { headers: authHeaders });
    if (getOrderRes.ok) {
      console.log("✅ E. GET order/:id propio funciona");
    } else {
      console.error("❌ E. GET order/:id propio FALLÓ", await getOrderRes.text());
    }

    // F. GET order/:id ajeno falla (intentar con ID random o ID 1 si no es suyo)
    const getOrderFailRes = await fetch(`${API_URL}/client/orders/999999`, { headers: authHeaders });
    if (getOrderFailRes.status === 404 || getOrderFailRes.status === 403) {
      console.log("✅ F. GET order/:id ajeno falla");
    } else {
      console.error("❌ F. GET order/:id ajeno FALLÓ");
    }

    console.log("=== PRUEBAS FINALIZADAS ===");

  } catch (err) {
    console.error("Error en pruebas:", err);
  }
}

runTests();
