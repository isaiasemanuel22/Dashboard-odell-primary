# Odell — de qué va el proyecto

Lectura obligada para cualquier agente antes de una tarea no trivial. Cambia
solo cuando cambia algo estructural. Estado del momento: `ESTADO.md`.

## El negocio
Odell es un emprendimiento de impresión 3D (FDM y resina), estampado (DTF,
sublimación), diseño y modelado. La app es su sistema de gestión: pedidos,
presupuestos, ventas de mostrador, cola de producción por impresora,
productos y costeo, insumos y bobinas, clientes (minoristas y revendedores),
billetera/tesorería y calendario. Dueño y usuario principal: Isaías. Textos de
interfaz en español rioplatense.

## Fuentes de verdad
- `docs/BUSINESS-RULES.md`: reglas de negocio; manda sobre el código.
  §1–§22 confirmadas, §25 lo que hace hoy el código, §26 propuestas `D-xx`
  (no implementar sin confirmación). Si falta una regla: POR DEFINIR, preguntar.
- `docs/CLAUDE.md`: forma de trabajo (planificar, delegar a Cursor, revisar).
- `docs/qa/errores-pendientes.md`: errores reportados (🔴/🟡/✅).

## Stack y estructura
Monorepo: `backend/` (NestJS + Prisma) y `frontend/` (Angular + NgRx).

**Backend** (`backend/src`, un módulo Nest por tema):
- Ventas: `orders/` pedidos, `quotes/` presupuestos, `sales/` ventas.
- Catálogo y costos: `products/`, `pricing/` (costeo), `supplies/` insumos,
  `suppliers/` proveedores, `brands/`, `categories/`.
- Producción: `print-jobs/` cola por impresora, `spools/` bobinas, `impresos/`.
- Plata y datos: `treasury/` tesorería, `dashboard/` métricas, `customers/`,
  `calendar/`.
- Plataforma: `auth/`, `users/`, `settings/` (Ajustes), `config/` (env),
  `upload/` (Firebase Storage), `realtime/`, `health/`, `reference-data/`,
  `common/`.
- Agentes (§28): `api-keys/` llaves por agente (el guard de `auth/` acepta
  `X-Api-Key` o `Bearer odl_live_…`, con permisos por `@ApiScopes`), `mcp/`
  servidor MCP en `/api/mcp`, `agent-approvals/` cola de aprobaciones y
  `alerts/` avisos programados (`@nestjs/schedule`, Resend). Estos módulos
  van directo a Prisma (como `users/`), no por `store/`, y están excluidos
  del guardado automático por ruta (`store/route-registry.ts`).
- **Persistencia:** el estado vive en `store/` (memoria). Con `DATABASE_URL`
  se guarda a MySQL vía `store/store-persistence.service.ts` (en serie, con
  reintento). Sin base, corre en memoria con `store/store.seed.ts`.
  Schema: `backend/prisma/schema.prisma`.

**Frontend** (`frontend/src/app`):
- Rutas (`app.routes.ts`): dashboard, billetera, mas, ventas, pedidos,
  presupuestos, cola, calendario, productos, insumos, clientes, ajustes.
- `pages/`: una carpeta por pantalla. `components/db-*` escritorio,
  `components/mobile-*` mobile (dock, sheet, form-shell…).
- `shared/utils/`: helpers de negocio (`pricing.util.ts`, `order.helpers.ts`…).
  Reusar antes de escribir uno nuevo.
- `store/`: NgRx (catalog, impresos, settings, supplies). Insumos siempre
  desde el store (`watchSupplies`), nunca lecturas aisladas.

## Comandos
- Local: `npm run dev` (raíz, backend + frontend). Launch del Browser pane:
  `odell-dev-4300` (backend 3000, front 4300).
- Build: `npm run build --prefix backend|frontend`.
- Tests: `npm test --prefix backend` (Jest, specs junto al código);
  frontend `ng test --watch=false --browsers=ChromeHeadless` con
  `CHROME_BIN=/usr/bin/google-chrome`.
- E2E: `npm run e2e` (Playwright, `e2e/`, detecta 4300 y luego 4200).
- Base: `npm run db:push` (local), `npm run db:push:heroku` (después del deploy).

## Entornos
- Backend: Heroku, app `odell-dashboard-api` (`Procfile`).
- Frontend: Netlify (`netlify.toml`), publica solo al pushear `main`.
  `firebase.json` es un hosting alternativo que no se usa.
- Archivos subidos: Firebase Storage.

## Cómo se trabaja
- Claude orquesta y delega: código a `cursor-agent` (o `odell-implementador`
  si el modo automático lo bloquea), revisión visual a `odell-qa-visual`,
  prueba funcional a `odell-tester`, búsquedas a `buscador`, comandos largos
  a `ejecutor`.
- Nunca en `main`: rama `feat/…` o `fix/…`, un commit por tarea, commits en
  español (`feat(modulo): …`). Deploy solo con OK de Isaías.
- Reglas de git, deploy, frontend y backend: `.claude/rules/`.

## Decisiones confirmadas (resumen; el detalle está en BUSINESS-RULES)
- Margen siempre sobre el costo: (precio − costo) ÷ costo.
- Hay tipo de cliente (revendedor con precio mayorista y compra mínima por
  cliente) y se registra medio de pago.
- Seña opcional; si se usa, arranca en Efectivo y sugiere el 50 %.
- «Entregado» entrega todo aunque haya tareas sin terminar.
- Producción: impresoras = perfiles de máquina FDM con costo propio; la
  purga AMS va al precio/kg promedio y se descuenta del stock.
- Acceso: solo usuarios dados de alta y activos; reseteo de base solo admin
  y con código por variable de entorno.

## Rumbo
Después de cerrar lo actual: separar Odell en un **módulo base** (catálogo,
ventas básicas, clientes) más **módulos opcionales** por rubro, para que sirva
a otros negocios. Al activar un módulo se adaptan menú, rutas, ajustes,
formularios, dashboard y permisos.
