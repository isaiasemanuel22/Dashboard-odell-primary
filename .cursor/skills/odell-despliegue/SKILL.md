---
name: odell-despliegue
description: >-
  Despliega Odell en producción: agrega archivos, commit con mensaje del
  cambio, push a GitHub (main) y después push a Heroku. Usar cuando el
  usuario pida desplegar, deploy, publicar, push a Heroku o sacar a
  producción.
---

# Despliegue Odell (commit → Git main → Heroku)

Orden fijo. No invertir pasos. No saltear el push a Git.

## Remotes y app

| Qué | Valor |
|-----|--------|
| GitHub | remote `origin`, rama **`main`** |
| Heroku | remote `heroku` → app `odell-dashboard-api`, rama **`main`** |
| API prod | confirmar con `heroku apps:info -a odell-dashboard-api` |
| Front Netlify | suele redeployar solo al pushear `main` a `origin` |

Si falta el remote `heroku`:

```bash
heroku git:remote -a odell-dashboard-api
```

## Antes de pushear

1. En paralelo: `git status -sb`, `git diff` / `git diff --staged`, `git log -5 --oneline`, `git remote -v`.
2. `heroku auth:whoami`. Si falla auth, parar y pedir login.
3. Destino Git: siempre **`origin main`**. No `--force` a `main` salvo pedido explícito.

## Paso 0 — Agregar y commit

Si hay cambios sin commit (tracked o untracked relevantes):

1. **Agregar** los archivos del cambio (no secrets: `.env`, credenciales, `firebase-service-account.json`, tokens).
   ```bash
   git add -A
   ```
   Si hay secrets en el working tree, **no** incluirlos; avisar y seguir solo con el resto.
2. Redactar un **mensaje de commit característico del cambio** (1–2 oraciones, foco en el *porqué*; estilo del `git log` del repo: corto, en español o el idioma que ya use el historial).
   - Ejemplos: `catálogo de tipos de filamento en ajustes`, `fix tozar API Heroku en build Netlify`, `ordenar paleta de colores`.
   - Prefijos útiles si encajan con el historial: `fix`, `feat`, etc. No inventar changelogs largos.
3. Commit con HEREDOC:
   ```bash
   git commit -m "$(cat <<'EOF'
   Mensaje característico acá.

   EOF
   )"
   ```
4. Si el hook de pre-commit falla, corregir y crear un commit **nuevo** (no `--amend` salvo las reglas estrictas de amend del proyecto).
5. Si no hay nada que commitear (working tree limpio), seguir al push con lo ya commiteado.

Invocar este agente **implica autorización a commitear** para el deploy. No pedir permiso extra para el commit del despliegue.

## Paso 1 — Push a Git (`origin` → `main`)

```bash
git push origin HEAD:main
```

Si ya estás en `main` y trackea `origin/main`:

```bash
git push origin main
```

- Esperar exit 0.
- Si falla, **no** continuar con Heroku. Informar el error.
- Shell con permisos de red/`all` si hace falta auth.

## Paso 2 — Push a Heroku (solo si el paso 1 OK)

```bash
git push heroku HEAD:main
```

- Esperar el build. Si falla, investigar el log y parar.
- No `--force` salvo pedido explícito.

## Paso 3 — Schema de DB (si hubo cambio de Prisma)

Si entraron cambios en `backend/prisma/schema.prisma`:

```bash
npm run db:push:heroku
```

Eso corre `prisma db push` **sin** `--accept-data-loss` por defecto.  
**Nunca** uses `ACCEPT_DATA_LOSS=1` en un deploy rutinario: puede vaciar tablas. Solo si el usuario lo pide explícitamente.

## Paso 4 — Verificar

```bash
curl -sS -o /dev/null -w "%{http_code}" https://odell-dashboard-api-bf200c02a0c9.herokuapp.com/api/health
```

Esperar `200`. Opcional: `heroku releases -a odell-dashboard-api -n 3`.

## Qué no hacer

- No pushear a Heroku si falló el push a `origin`.
- No incluir secrets en el commit.
- No deployar Netlify a mano salvo pedido (el push a Git suele alcanzar).
- No `heroku config:set` ni reset de DB salvo pedido explícito.
- No `ACCEPT_DATA_LOSS=1` / `--accept-data-loss` salvo pedido explícito.
- No matar `npm run dev` local.

## Respuesta al usuario

En español, breve:

1. Mensaje del commit (si hubo).
2. Push a `origin` main (OK / error).
3. Push a Heroku (OK / error + causa).
4. Si corrió `db:push:heroku`, decirlo.
5. Health del API.
