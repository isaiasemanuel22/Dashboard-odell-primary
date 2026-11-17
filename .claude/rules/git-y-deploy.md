# Git, deploy y comandos

Se carga siempre. Estado del momento (versión en producción, rama actual):
`docs/contexto/ESTADO.md`.

## Git
- Nunca trabajar en `main`. Una rama por cambio: `feat/<tema>` o `fix/<tema>`.
- Un commit por tarea, en español: `feat(<módulo>): <qué> [§n|D-xx]`.
- Sin force-push.
- Claude y Cursor no editan los mismos archivos al mismo tiempo.

## Qué no commitear
- `.playwright-mcp/`, `frontend/src/Untitled`, `.claude/launch.json`.
- Agregar con `git add <dir> ':!frontend/src/Untitled'`.

## Deploy (solo con OK de Isaías)
- Orden: push a origin → push a heroku → recién después
  `npm run db:push:heroku` si hubo cambios de esquema. Nunca ACCEPT_DATA_LOSS.
- Netlify publica el frontend solo al pushear `main`.
- Lockfile del backend: regenerarlo siempre con npm 10.9.9 (el de Heroku):
  `npx npm@10.9.9 install --package-lock-only --registry=https://registry.npmjs.org`.
  El npm local (11.x) y el registry configurado rompen `npm ci` en Heroku.
- Si el worktree `../dashboard-rediseno` tiene `main` tomado:
  `git push origin HEAD:main` y `git push heroku HEAD:main`.

## Comandos

| Para qué | Frontend (Angular) | Backend (NestJS) |
|----------|--------------------|------------------|
| Build | `npm run build --prefix frontend` | `npm run build --prefix backend` |
| Tests | `ng test --watch=false --browsers=ChromeHeadless` en `frontend/`, con `CHROME_BIN=/usr/bin/google-chrome` | `npm test --prefix backend` (Jest) |
| Lint | — (sin script) | `npx eslint "src/**/*.ts"` en `backend/` (sin `--fix`) |
| Levantar en local | `npm run dev` en la raíz (backend + frontend) | `npm run dev:backend` |

- E2E: `npm run e2e` en la raíz (Playwright, `e2e/`).
