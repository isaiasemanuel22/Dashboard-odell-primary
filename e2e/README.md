# Suite E2E (Playwright)

## Requisitos
- Frontend en http://localhost:4300 (launch `odell-dev-4300`) o http://localhost:4200 (launch `odell-dev`) y backend en http://localhost:3000 ya levantados ya levantados. La suite no los levanta. Sin `E2E_BASE_URL`, `playwright.config.ts` prueba 4300 y luego 4200 y usa el primero que responde; con `E2E_BASE_URL` se usa tal cual.
- `npm install` en la raiz y `npx playwright install chromium` (o `E2E_CHANNEL=chrome` para usar Google Chrome del sistema).

## Login
No hay globalSetup (hay `globalTeardown`, ver Limpieza). En local la app acepta la sesion de prueba `testing@test.com` (solo fuera de produccion, ver `AuthService`), que se guarda en `sessionStorage`; `e2e/fixtures.ts` la siembra con un init script. El backend con `REQUIRE_AUTH` distinto de `true` no exige token. Si apuntas a otro entorno con auth real, define `E2E_BEARER_TOKEN` (ver `.env.e2e.example`). Nunca uses credenciales de produccion.

## Correr
- `npm run e2e` toda la suite; `npx playwright test e2e/smoke.spec.ts` un spec.
- `npm run e2e:report` abre el informe HTML.

## Convenciones
- Importar `test`/`expect` desde `./fixtures` (trae login y `consoleProblems`), no desde `@playwright/test`.
- Un spec por area: `e2e/<area>.spec.ts`.
- Todo dato creado empieza con `E2E-<timestamp>` (`e2eName()` de `helpers/api.ts`); crealo por API y limpialo en `afterAll` con `cleanupCreated()`. `purgeE2EData()` barre lo que quede.
- Workers 1: la base local es compartida y el store esta en memoria.
- No tocar Ajustes generales, no resetear la base (`/settings/reset-database`), no borrar datos que no sean E2E-.
- Preferir locators por rol/texto; `data-testid` solo si no hay otra opcion.

## Limpieza de datos
- `e2e/global-teardown.ts` llama a `purgeE2EData()` al terminar y borra por API todo lo `E2E-` borrable.
- La API no deja borrar pedidos cancelados, sus tareas, presupuestos aceptados ni clientes con pedidos. El unico borrado real del backend es `/settings/reset-database`, que borra toda la base y no se usa. Esos registros quedan en la base local con el prefijo `E2E-<timestamp>`; se filtran buscando `E2E-` en nombre/cliente.
