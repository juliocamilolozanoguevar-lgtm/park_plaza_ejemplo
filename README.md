# Hotel Park Plaza ERP

ERP hotelero full stack con React, Vite, Tailwind CSS, Express, Prisma ORM, PostgreSQL, JWT y bcrypt.

PostgreSQL es la fuente unica de datos. El frontend solo usa `localStorage` para guardar el token JWT.

## Requisitos

- Node.js 20 o superior
- PostgreSQL 14 o superior
- npm
- Docker Desktop, si se ejecuta con Docker Compose

## Ejecutar con Docker

Copia las variables de entorno de ejemplo:

```bash
copy .env.example .env
```

Edita `.env` y define al menos:

```env
POSTGRES_PASSWORD=tu_password_segura
JWT_SECRET=tu_secreto_seguro
```

Levanta el sistema completo:

```bash
docker compose up -d --build
```

Verifica servicios:

```bash
docker compose ps
```

Carga datos demo iniciales:

```bash
docker compose exec -e ALLOW_DEMO_SEED=true backend npx prisma db seed
```

Abre el frontend:

```text
http://localhost:5173
```

API:

```text
http://localhost:3000/api
```

Health check:

```text
http://localhost:3000/api/health
```

Detener servicios:

```bash
docker compose down
```

Reiniciar base local desde cero:

```bash
docker compose down -v
docker compose up -d --build
```

Credenciales demo luego del seed:

```text
ADMINISTRADOR
admin@parkplaza.com
ParkPlaza123*

RECEPCION
recepcion@parkplaza.com
ParkPlaza123*

RESTAURANTE
restaurante@parkplaza.com
ParkPlaza123*

BARTENDER
bartender@parkplaza.com
ParkPlaza123*

PISCINA
piscina@parkplaza.com
ParkPlaza123*

LIMPIEZA
limpieza@parkplaza.com
ParkPlaza123*
```

Estas credenciales son solo para desarrollo.

## Configurar PostgreSQL

Crea la base de datos de desarrollo:

```sql
CREATE DATABASE hotel_park_plaza;
```

Datos sugeridos:

- Base de datos: `hotel_park_plaza`
- Usuario: `postgres`
- Puerto: `5432`

## Backend

```bash
cd server
npm install
```

Copia el archivo de ejemplo:

```bash
copy .env.example .env
```

Edita `server/.env` con tu contrasena real de PostgreSQL:

```env
DATABASE_URL="postgresql://postgres:TU_PASSWORD@localhost:5432/hotel_park_plaza?schema=public"
JWT_SECRET="hotel_park_plaza_dev_secret"
PORT=3000
FRONTEND_URL="http://localhost:5173"
```

Preparar Prisma:

```bash
npx prisma generate
npx prisma migrate dev
npx prisma db seed
```

Desde la raiz tambien puedes cargar el entorno demo completo:

```bash
npm run db:seed
```

Alias equivalente:

```bash
npm run db:demo
```

Para reconstruir la base demo local desde el schema actual y volver a cargar datos:

```bash
npm run db:reset-demo
```

`db:reset-demo` esta bloqueado si `NODE_ENV=production`.

Iniciar backend:

```bash
npm run dev
```

API:

```text
http://localhost:3000/api
```

Health check:

```text
http://localhost:3000/api/health
```

Respuesta esperada:

```json
{
  "status": "ok",
  "database": "connected"
}
```

## Frontend

```bash
cd client
npm install
```

Copia el archivo de ejemplo:

```bash
copy .env.example .env
```

Contenido:

```env
VITE_API_URL=http://localhost:3000/api
```

Iniciar frontend:

```bash
npm run dev
```

Abrir:

```text
http://localhost:5173
```

## Ejecutar todo desde la raiz

Despues de instalar dependencias:

```bash
npm run dev
```

Esto inicia backend Express y frontend Vite con `concurrently`.

## Credenciales de desarrollo

Todas usan la contrasena:

```text
ParkPlaza123*
```

Usuarios seed:

- Administrador: `admin@parkplaza.com`
- Recepcionista: `recepcion@parkplaza.com`
- Restaurante: `restaurante@parkplaza.com`
- Bartender: `bartender@parkplaza.com`
- Piscina: `piscina@parkplaza.com`
- Limpieza: `limpieza@parkplaza.com`

Estas credenciales son solo para desarrollo.

## Redireccion por rol

- Administrador: `/dashboard`
- Recepcionista: `/recepcion`
- Restaurante: `/restaurante/pedidos`
- Bartender: `/bartender/pendientes`
- Piscina: `/piscina/ingresos`
- Limpieza: `/limpieza/pendientes`

## Datos iniciales

El seed crea datos consistentes calculables desde PostgreSQL:

- 50 habitaciones
- 25 habitaciones ocupadas
- 8 habitaciones libres
- 6 habitaciones reservadas
- 5 habitaciones en limpieza
- 3 habitaciones en mantenimiento
- 3 habitaciones fuera de servicio
- 12 reservas de hoy
- 3 no-show de hoy
- Ingresos del dia: `S/ 5,320.00`
- Productos con stock bajo:
  - Cerveza Corona: stock 5, minimo 10
  - Aceite: stock 8, minimo 10
  - Pollo: stock 0, minimo 5
  - Vodka: stock 0, minimo 3
- Espacios de eventos: Terraza y Mirador
- 10 eventos con estados variados
- 20 espacios de cochera, 12 ocupados y 8 libres
- 40 clientes
- 40 reservas
- 25 estadias activas
- 35 pedidos entre restaurante y bartender
- 20 ingresos de piscina
- 10 tareas de limpieza
- 18 reportes operativos
- 39 productos
- 10 proveedores
- 8 compras

## Estructura

```text
client/
  src/
    components/
    context/
    constants/
    hooks/
    layouts/
    modules/
    pages/
    services/

server/
  src/
    config/
    controllers/
    middlewares/
    routes/
    services/
    utils/
    validators/
  prisma/
    schema.prisma
    seed.js
```

## Modulos y rutas principales

Administrador:

```text
/dashboard
/recepcion
/habitaciones
/reservas
/clientes
/piscina/ingresos
/restaurante/pedidos
/bartender/pendientes
/eventos/calendario
/cochera
/limpieza/pendientes
/inventario
/compras
/proveedores
/usuarios
/roles
/caja
/reportes
/auditoria
/configuracion
```

Recepcion:

```text
/recepcion
/clientes
/reservas
/habitaciones
/checkin
/checkout
/operaciones
/consumos
/cochera
/pagos
/facturacion
/eventos/calendario
```

Trabajadores:

```text
/bartender/pendientes
/bartender/preparando
/bartender/entregados

/restaurante/pedidos
/restaurante/cocina
/restaurante/preparacion
/restaurante/entregados

/piscina/ingresos
/piscina/validar-qr
/piscina/clientes-activos
/piscina/reportes

/limpieza/pendientes
/limpieza/finalizadas
/limpieza/evidencias
/limpieza/reportes
```

## Nota sobre migraciones

El schema Prisma ya esta alineado con los prompts nuevos y valida correctamente. Si este proyecto aun no ha sido migrado a una base de datos real, conviene resetear la migracion inicial generada anteriormente y recrearla desde el schema actual antes de ejecutar `npx prisma migrate dev`.
