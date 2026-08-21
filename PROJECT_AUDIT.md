# PROJECT AUDIT - ERP Hotel Park Plaza

Fecha de auditoria: 2026-08-08

## Resumen Ejecutivo

El proyecto ya tiene una base full-stack real con React + Vite, Express, Prisma y PostgreSQL. No es solo una maqueta: existen endpoints y pantallas funcionales para autenticacion, dashboard, clientes, habitaciones, reservas, check-in, check-out, pedidos operativos, piscina, limpieza, eventos, inventario y reportes.

Los mayores riesgos detectados inicialmente fueron:

- La migracion Prisma inicial esta desactualizada frente al `schema.prisma` actual.
- Varias rutas del frontend apuntaban a `ModulePlaceholder`.
- Varios endpoints administrativos usan un `GET` generico y no tienen CRUD real.
- El sistema visual ya usa parte de la identidad Park Plaza, pero no aplica todavia todos los tokens oficiales ni una estructura agrupada de sidebar.
- El seed funciona como carga inicial, pero borra datos antes de recrearlos; debe usarse conscientemente.

## Estructura Detectada

```text
client/
  React + Vite + Tailwind CSS
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
  Express + Prisma + JWT + bcrypt
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
    migrations/
```

## Scripts Encontrados

Raiz:

- `npm run dev`: inicia frontend y backend con `concurrently`.
- `npm run db:generate`: genera Prisma Client.
- `npm run db:push`: ejecuta Prisma db push.
- `npm run db:migrate`: ejecuta migracion Prisma.
- `npm run db:seed`: ejecuta seed.

Frontend:

- `npm run dev`: Vite en `0.0.0.0:5173`.
- `npm run build`: build de produccion.
- `npm run preview`: preview en `0.0.0.0:5173`.

Backend:

- `npm run dev`: `nodemon src/index.js`.
- `npm start`: `node src/index.js`.
- `npm run prisma:generate`.
- `npm run prisma:migrate`.
- `npm run prisma:seed`.
- `npm run prisma:studio`.

## Variables de Entorno Detectadas

Frontend:

- `VITE_API_URL`

Backend:

- `PORT`
- `FRONTEND_URL`
- `JWT_SECRET`
- `DATABASE_URL`
- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`

Docker:

- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `POSTGRES_PORT`
- `BACKEND_PORT`
- `FRONTEND_PORT`

## Puertos

- Frontend Vite/desarrollo: `5173`.
- Frontend Docker/Nginx publicado: `5173 -> 80`.
- Backend Express: `3000`.
- PostgreSQL: `5432`.

## Rutas Frontend Existentes

Funcionales o parcialmente funcionales:

- `/dashboard`
- `/clientes`
- `/habitaciones`
- `/reservas`
- `/checkin`
- `/checkout`
- `/restaurante/pedidos`
- `/restaurante/cocina`
- `/restaurante/preparacion`
- `/restaurante/entregados`
- `/bartender/pendientes`
- `/bartender/preparando`
- `/bartender/entregados`
- `/piscina/ingresos`
- `/piscina/validar-qr`
- `/piscina/clientes-activos`
- `/piscina/reportes`
- `/eventos/calendario`
- `/eventos/reservas`
- `/eventos/terraza`
- `/eventos/mirador`
- `/limpieza/pendientes`
- `/limpieza/finalizadas`
- `/limpieza/evidencias`
- `/limpieza/reportes`
- `/inventario`
- `/inventario/kardex`
- `/reportes`

Rutas que estaban con placeholder al iniciar la auditoria y ya fueron sustituidas por paginas conectadas de minimo viable:

- `/recepcion`
- `/operaciones`
- `/consumos`
- `/eventos/contratos`
- `/eventos/pagos`
- `/cochera`
- `/compras`
- `/proveedores`
- `/pagos`
- `/facturacion`
- `/caja`
- `/usuarios`
- `/roles`
- `/auditoria`
- `/configuracion`

## Endpoints Backend Existentes

Salud/autenticacion:

- `GET /api/health`
- `POST /api/auth/login`
- `GET /api/auth/me`

Funcionales especificos:

- `/api/dashboard`
- `/api/clients`, `/api/clientes`
- `/api/rooms`, `/api/habitaciones`
- `/api/reservations`, `/api/reservas`
- `/api/checkin`
- `/api/checkout`
- `/api/orders`
- `/api/restaurant`, `/api/restaurante`
- `/api/bar`, `/api/bartender`
- `/api/pool`, `/api/piscina`
- `/api/events`, `/api/eventos`
- `/api/cleaning`, `/api/limpieza`
- `/api/products`
- `/api/inventory`, `/api/inventario`
- `/api/reports`, `/api/reportes`

Endpoints genericos solo lectura:

- `/api/parking`, `/api/cochera`
- `/api/purchases`, `/api/compras`
- `/api/suppliers`, `/api/proveedores`
- `/api/payments`, `/api/pagos`
- `/api/invoices`, `/api/facturacion`
- `/api/cash`, `/api/caja`
- `/api/users`, `/api/usuarios`
- `/api/roles`
- `/api/audit`, `/api/auditoria`
- `/api/settings`, `/api/configuracion`

## Endpoints Faltantes o Incompletos

- Recepcion operativa: resumen de llegadas, salidas, pendientes y habitaciones disponibles.
- Cochera: registrar entrada/salida vehicular y asociar cliente.
- Compras: solicitudes, ordenes y recepciones conectadas a inventario.
- Proveedores: CRUD completo y detalle con historial.
- Caja: apertura/cierre, resumen, metodos de pago y movimientos.
- Usuarios: CRUD completo, cambio de estado y ultimo acceso.
- Roles/permisos: matriz editable.
- Auditoria: filtros reales y paginacion.
- Configuracion: tabs hotel/sistema/habitaciones/seguridad/usuarios.
- Contratos de eventos: creacion/consulta.
- Pagos de eventos: pantalla dedicada.
- Consumos operativos: vista para recepcion.

## Modelos Prisma Encontrados

Principales:

- `Role`, `Permission`, `RolePermission`
- `User`
- `Client`
- `RoomType`, `Room`
- `Reservation`, `Stay`
- `Order`, `OrderItem`
- `Consumption`
- `Payment`
- `Invoice`
- `PoolEntry`, `PoolReport`
- `EventSpace`, `Event`, `EventContract`
- `ParkingSpace`, `VehicleEntry`
- `CleaningTask`, `CleaningEvidence`, `CleaningReport`
- `OperationalReport`, `OperationalReportEvidence`
- `Category`, `Product`, `Recipe`, `RecipeItem`, `InventoryMovement`
- `Supplier`, `Purchase`, `PurchaseItem`
- `SupplyRequest`, `SupplyRequestItem`
- `CashRegister`, `CashMovement`
- `AuditLog`
- `HotelSettings`

## Problemas Prisma / Base de Datos

- `schema.prisma` es mas nuevo que la migracion `20260808112000_init`.
- La migracion inicial no crea tablas/modelos que el seed usa, por ejemplo `OperationalReportEvidence`.
- Hay diferencias de enums entre migracion y schema actual.
- En Docker local se ajusto el backend para usar `prisma db push --accept-data-loss` al arrancar, porque se esta trabajando con base limpia. Para produccion se debe crear una migracion nueva alineada y no depender de `db push`.

## Modulos Completos o Cercanos

- Login/autenticacion JWT.
- Dashboard administrador con metricas reales desde PostgreSQL.
- Clientes: lista, busqueda, creacion y detalle basico.
- Habitaciones: listado visual, filtros y detalle.
- Reservas: listado y formulario de nueva reserva.
- Check-in/check-out: flujo funcional basico.
- Eventos: calendario/reservas/espacios parcialmente funcionales.
- Inventario: productos, movimientos y resumen parcial.
- Reportes operativos: listado, filtros, evidencias y estados.
- Limpieza: tareas, evidencias, iniciar/finalizar y reportes.
- Piscina: ingresos, clientes activos y reportes.
- Restaurante/Bartender: pedidos y cambios de estado.
- Recepcion, Cochera, Proveedores, Compras, Pagos, Facturacion, Caja, Usuarios, Roles y Configuracion: vistas conectadas de minimo viable con endpoints especificos.

## Modulos Parcialmente Completos

- Eventos: faltan contratos y pagos como vistas completas.
- Inventario: falta kardex visual dedicado y flujo completo de compras.
- Reportes: funcional, pero requiere detalle mas completo con historial/fotos/producto relacionado.
- Auditoria: aun requiere filtros reales y paginacion dedicada.
- Configuracion: vista funcional inicial, falta separar opciones avanzadas por tabs.

## Modulos Vacios o Placeholder

- Operaciones
- Consumos
- Auditoria

## Componentes Reutilizables Existentes

- `MetricCard`
- `StatusBadge`
- `SearchInput`
- `Table`
- `Modal`
- `Toast`
- `EmptyState`
- `LoadingSpinner`

## Componentes Reutilizables Faltantes

- `DatePicker`
- `DataTable`
- `Pagination`
- `Drawer`
- `LoadingState`
- `ConfirmDialog`
- `FileUploader`
- `ImagePreview`
- `FilterBar`

Componentes agregados durante la refactorizacion:

- `Button`
- `Input`
- `Select`
- `Tabs`
- `Alert`
- `Skeleton`
- `PageHeader`
- `SectionHeader`
- `ModuleCard`

## Problemas Visuales y de Consistencia

- El theme Tailwind tiene colores Park Plaza parciales, pero faltan tokens oficiales: `green-soft`, `gold-soft`, `border`, `black`, `white`, `danger-soft`.
- Se repiten clases de inputs/botones directamente en modulos.
- El sidebar no agrupa navegacion por secciones para administrador.
- El topbar tiene buscador visual no conectado y notificaciones hardcodeadas.
- Algunas paginas usan radios/sombras/espaciados inconsistentes.
- Falta `src/styles/tokens.js` o equivalente.
- Falta documentacion `DESIGN_SYSTEM.md`.

## Problemas de Navegacion

- El sidebar navega a rutas placeholder.
- Algunas rutas distintas cargan el mismo componente sin variar modo claramente.
- `/limpieza/reportes` existe aunque el prompt pide eliminar Reportes del sidebar de limpieza e integrarlo en Evidencias.
- Topbar no conoce todos los titulos/rutas y cae en "Modulo ERP".

## Datos Hardcodeados o Inconsistentes

- Notificaciones del topbar muestran `3` fijo.
- Algunos quick links y textos de dashboard son fijos aunque las metricas vienen de DB.
- Seed usa credenciales demo y borra datos antes de cargar.
- Varias vistas comparten textos generales sin comportamiento especifico por subruta.

## Permisos

Fortalezas:

- Middleware `authenticate` carga permisos desde rol.
- `authorize` permite todo a `ADMINISTRADOR`.
- Rutas especificas validan permisos por modulo/accion.

Problemas:

- Recursos genericos solo tienen `VER`.
- Falta CRUD backend para varios modulos, por tanto no hay validacion completa de permisos de `CREAR`, `EDITAR`, `ELIMINAR`.
- Menu frontend depende del rol, pero algunas rutas protegidas existen aunque la vista sea placeholder.
- Falta registrar ultimo acceso de usuario.

## Relaciones de Datos

Relaciones existentes importantes:

- Reserva -> Cliente -> Habitacion.
- Reserva -> Stay.
- Check-out finaliza estadia y debe llevar habitacion a limpieza.
- Orden -> Items -> Producto.
- Pago -> Caja mediante `CashMovement`.
- Evento -> Cliente -> Espacio -> Pagos.
- Limpieza -> Evidencias/Reportes.
- Reporte operativo -> Habitacion/Tarea/Producto/Evidencias.
- Compra -> Proveedor -> Items -> Producto.

Pendiente de consolidar:

- Pedidos restaurante/bartender como consumos de huesped.
- Compra/recepcion actualizando inventario automaticamente.
- Reportes operativos con historial de cambios.
- Pagos/facturacion/caja con pantallas dedicadas.
- Habitacion libre despues de limpieza finalizada.

## Lista de Tareas Priorizada

1. Estabilizar Docker/Prisma/seed para base local limpia. Estado: en progreso.
2. Crear tokens visuales oficiales y ampliar theme Tailwind. Estado: completado base.
3. Refactorizar layout: sidebar agrupado, topbar, `PageHeader`, `MainContent`. Estado: completado base.
4. Crear componentes UI base reutilizables: `Button`, `Input`, `Select`, `DataTable`, `Tabs`, `Drawer`, `Alert`, `Skeleton`, `FilterBar`. Estado: parcial.
5. Eliminar `ModulePlaceholder` de rutas visibles y sustituir por pantallas funcionales de minimo viable. Estado: completado base.
6. Implementar vista Recepcion operativa real.
7. Implementar Cochera con cards y registro entrada/salida.
8. Implementar Caja/Pagos/Facturacion como flujo conectado.
9. Implementar Proveedores y Compras con CRUD/conexion inventario.
10. Implementar Usuarios y Roles/Permisos con endpoints completos.
11. Implementar Auditoria y Configuracion.
12. Ajustar Eventos contratos/pagos.
13. Revisar permisos backend por accion.
14. Agregar documentacion `DESIGN_SYSTEM.md` y actualizar `README.md`.
15. Ejecutar build y pruebas por rol.

## Estado de Auditoria

Completado:

- Estructura real del proyecto.
- Rutas frontend.
- Endpoints backend.
- Modelos Prisma principales.
- Placeholders detectados.
- Problemas Docker/Prisma detectados.
- Problemas visuales principales.
- Tokens visuales base creados.
- Sidebar agrupado por rol.
- Topbar refactorizado.
- Rutas placeholder reemplazadas por vistas conectadas de minimo viable.
- Build frontend validado.
- Clientes y Habitaciones migrados a componentes UI base.
- Inventario y Reportes migrados parcialmente a tokens/componentes oficiales.
- Reservas ahora usa header oficial y drawer de detalle en lugar de `alert()`.
- Eventos migrado a cabecera, filtros y acciones con componentes UI base.
- Limpieza, Piscina y Restaurante/Bartender migrados a cabeceras, cards y botones del sistema visual.
- Vistas administrativas de minimo viable conectadas a endpoints especificos.

Pendiente durante refactor:

- Validacion visual con capturas por modulo.
- Pruebas completas por rol.
- Reconciliacion final de migraciones Prisma para produccion.
