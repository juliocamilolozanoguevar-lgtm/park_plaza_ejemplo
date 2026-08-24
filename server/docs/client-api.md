# Documentación de la API Cliente (Portal / App)
ERP Hotel Park Plaza

Esta API está diseñada exclusivamente para que el huésped pueda auto-gestionar sus pedidos, revisar sus consumos, solicitar eventos y consultar información pública.

## 1. Endpoints Públicos
(Disponibles sin JWT)

### `GET /api/public/hotel`
Retorna información básica del hotel (nombre, ruc, logo, moneda).

### `GET /api/public/room-types`
Retorna los tipos de habitaciones activos.

### `GET /api/public/rooms/available`
Consulta habitaciones disponibles por fechas.
- Query params: `checkIn`, `checkOut`, `guests`, `typeId` (opcional).

### `GET /api/public/services`
Lista de servicios adicionales (Piscina, Mirador) disponibles.

### `GET /api/public/services/:type/availability`
Consulta disponibilidad real de Piscina o Mirador.

Query params:
- `date=YYYY-MM-DD`: devuelve un único día.
- `from=YYYY-MM-DD`: devuelve una ventana de 21 días.

Estados que ocupan cupo: `PENDIENTE`, `CONFIRMADA`, `EN_USO`.
Estados que liberan cupo: `CANCELADA`, `FINALIZADA`.

### `GET /api/public/services/:type/plans`
Lista de planes/tarifas para el servicio.

### `GET /api/public/services/:type/extras`
Lista de extras opcionales para el servicio.
- Query params: `checkIn`, `checkOut`, `guests`, `typeId` (opcional).

### `POST /api/public/reservations`
Crea una reserva desde la web pública.

### `GET /api/public/reservations/:code`
Consulta el estado de una reserva usando el código. Requiere `documentNumber` por seguridad en query parameters.

---

## 2. Autenticación Cliente (Sesión)

### `POST /api/client/session`
Inicia sesión como huésped en el portal. Requiere tener una **Estadía Activa** (status `ACTIVA`).

**Payload:**
```json
{
  "reservationCode": "DEMO-RSV-001",
  "documentNumber": "12345678"
}
```

**Respuesta:**
```json
{
  "token": "eyJhbGciOi...",
  "client": {
    "firstName": "Juan",
    "lastName": "Perez"
  },
  "stay": {
    "id": 1,
    "roomId": 10,
    "checkInAt": "2026-08-24T10:00:00.000Z"
  }
}
```

> **IMPORTANTE:** Todos los endpoints siguientes requieren el header `Authorization: Bearer {token}`.

---

## 3. Perfil y Consumos

### `GET /api/client/profile`
Retorna los datos del perfil y la información de la estadía actual y la habitación.

### `GET /api/client/consumptions`
Lista los consumos generados y asociados a la estadía actual.

---

## 4. Pedidos (Restaurante y Bartender)

### `GET /api/client/menu/:area`
Retorna el menú. `area` puede ser `RESTAURANTE` o `BARTENDER`.

**DTO:**
```json
[
  {
    "id": 1,
    "name": "Lomo Saltado",
    "category": "Platos Principales",
    "price": 45.00,
    "description": "Plato porcion",
    "available": true
  }
]
```
*(No expone el stock numérico exacto por seguridad y lógica de negocio).*

### `POST /api/client/orders`
Crea un pedido. Los precios son calculados en el servidor, no se lee ningún precio del payload.

**Payload:**
```json
{
  "area": "RESTAURANTE",
  "items": [
    {
      "productId": 1,
      "quantity": 2
    }
  ],
  "notes": "Sin cebolla por favor."
}
```

### `GET /api/client/orders`
Lista los pedidos realizados durante la estadía actual. Usa el DTO estándar.

### `GET /api/client/orders/:id`
Muestra el detalle del pedido. Verifica propiedad de la estadía (`stayId`).

**DTO:**
```json
{
  "id": 123,
  "code": "PED-2026-ABCDEF",
  "area": "RESTAURANTE",
  "status": "PENDIENTE",
  "total": 90.00,
  "createdAt": "2026-08-24T12:00:00.000Z",
  "updatedAt": "2026-08-24T12:00:00.000Z",
  "items": [
    {
      "id": 456,
      "name": "Lomo Saltado",
      "quantity": 2,
      "price": 45.00
    }
  ]
}
```

---

## 5. Eventos

### `GET /api/client/events/spaces`
Lista los espacios de eventos disponibles y activos.

### `POST /api/client/events`
Solicita un evento. Este se guarda con estado inicial `COTIZACION`.

**Payload:**
```json
{
  "spaceId": 1,
  "name": "Aniversario",
  "type": "Cena Privada",
  "startsAt": "2026-09-10T19:00:00Z",
  "guests": 20,
  "notes": "Menú vegetariano opcional."
}
```

### `GET /api/client/events`
Lista los eventos creados por el cliente. Solo expone eventos pertenecientes al `clientId` autenticado.

### `GET /api/client/events/:id`
Detalle del evento. Valida ownership.

---

## 6. Piscina y Mirador (Reservas de Servicios)

### `GET /api/client/service-reservations`
Lista todas las reservas de servicios asociadas a la estadía del huésped.

### `GET /api/client/service-reservations/:id`
Detalle de la reserva, incluyendo QR y desgloses.

### `POST /api/client/service-reservations`
Crea una reserva de servicio (Piscina o Mirador). Protegido contra sobreventa (Transacciones concurrentes).

**Payload:**
```json
{
  "serviceType": "PISCINA",
  "date": "2026-08-25",
  "slotId": 1,
  "planId": 1,
  "adults": 2,
  "children": 1,
  "extras": [
    { "id": 1, "quantity": 2 }
  ],
  "notes": "Necesitamos toallas extras"
}
```

### `PATCH /api/client/service-reservations/:id/cancel`
Cancela la reserva siempre y cuando su estado sea `PENDIENTE` o `CONFIRMADA`.
Si existen pagos registrados, se conservan para gestión administrativa; la devolución no está automatizada.

### `POST /api/client/service-reservations/:id/payments`
Registra un pago de una reserva de servicio. La identidad se deriva del JWT del cliente; el body no puede definir `clientId`, `stayId` ni `serviceReservationId`.

**Payload:**
```json
{
  "method": "YAPE",
  "amount": 50,
  "reference": "OPERACION-123"
}
```

Regla de confirmación:
- Pago parcial: la reserva sigue `PENDIENTE`.
- Pago total: `balance = 0` y la reserva pasa a `CONFIRMADA`.
- Sobrepago: rechazado.

### Estados y QR
- `PENDIENTE`: no permite check-in y el QR no se expone como válido.
- `CONFIRMADA`: QR válido para acceso.
- `EN_USO`: QR ya consumido.
- `FINALIZADA`: QR no reutilizable.
- `CANCELADA`: QR inválido.

### Endpoints internos
- Piscina check-in: `POST /api/pool/service-reservations/:id/check-in`.
- Piscina finalizar: `PATCH /api/pool/service-reservations/:id/complete`.
- Mirador check-in: `POST /api/service-reservations/:id/check-in`.
- Mirador finalizar: `PATCH /api/service-reservations/:id/complete`.

Piscina crea un `PoolEntry` al check-in. Mirador no crea `PoolEntry`.

### Legacy
`POST /api/client/pool` queda como endpoint legado/deprecated. Las nuevas reservas de Piscina y Mirador deben usar `ServiceReservation`.

## 7. Socket.IO (Tiempo Real)

Para recibir notificaciones en vivo del estado del pedido (ej. de PENDIENTE a PREPARANDO), el cliente puede conectarse a WebSocket.

**URL de Conexión:**
La misma URL que el backend, puerto configurado (ej. `http://localhost:3000`).

**Configuración Inicial (Auth):**
```js
import { io } from "socket.io-client";

const socket = io("http://localhost:3000", {
  auth: {
    token: "TU_JWT_AQUI"
  }
});
```
Al validarse el token, el servidor une al socket a una habitación (room) llamada `stay_{stayId}`. Nadie de otra estadía puede escuchar esos eventos.

**Eventos Escuchables:**
- `order:status_updated`
- `service-reservation:created`
- `service-reservation:updated`
- `service-reservation:cancelled`

**Payload Emitido (`order:status_updated`):**
```json
{
  "orderId": 123,
  "code": "PED-2026-ABCDEF",
  "status": "PREPARANDO",
  "area": "RESTAURANTE",
  "updatedAt": "2026-08-24T12:00:00.000Z"
}
```
