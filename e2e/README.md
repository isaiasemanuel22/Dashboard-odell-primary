# Suite E2E (Playwright)

## Requisitos
- Frontend en http://localhost:4300 y backend en http://localhost:3000 ya levantados (launch `odell-dev-4300`). La suite no los levanta.
- `npm install` en la raiz y `npx playwright install chromium` (o `E2E_CHANNEL=chrome` para usar Google Chrome del sistema).

## Login
No hay globalSetup. En local la app acepta la sesion de prueba `testing@test.com` (solo fuera de produccion, ver `AuthService`), que se guarda en `sessionStorage`; `e2e/fixtures.ts` la siembra con un init script. El backend con `REQUIRE_AUTH` distinto de `true` no exige token. Si apuntas a otro entorno con auth real, define `E2E_BEARER_TOKEN` (ver `.env.e2e.example`). Nunca uses credenciales de produccion.

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
