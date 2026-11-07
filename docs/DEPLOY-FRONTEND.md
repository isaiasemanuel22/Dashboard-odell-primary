# Deploy del frontend (Netlify)

El frontend Angular vive en **Netlify** y se publica solo cada vez que se pushea `main` a GitHub. No hace falta correr ningún comando para publicar.

URL pública: `https://<sitio>.netlify.app` (el nombre real no está en el repo; se ve en el panel de Netlify).

## Cómo se publica

1. Pusheás (o mergeás) a `main` en GitHub.
2. Netlify detecta el commit, compila y publica.
3. La configuración sale de `netlify.toml` (raíz del repo), no del panel.

## Configuración (`netlify.toml`)

| Clave | Valor |
|-------|-------|
| Base directory | `frontend` |
| Build command | `npm ci && npm run build:prod` |
| Publish directory | `dist/frontend/browser` (relativo a `base`) |
| Node | `22` (`NODE_VERSION`) |
| Redirect SPA | `/*` → `/index.html` (status 200) |
| Cache | `index.html` sin cache; `*.js` y `*.css` con `immutable` a 1 año |

## URL de la API en el build

`npm run build:prod` corre `scripts/prepare-env.mjs production`, que genera `environment.prod.ts` leyendo la variable **`API_URL`**.

Hoy `API_URL` está definida en `netlify.toml` (`[build.environment]`):

```
API_URL=https://odell-dashboard-api-bf200c02a0c9.herokuapp.com/api
```

Para cambiarla sin tocar el repo, definila en Netlify: Site settings → Environment variables → `API_URL`. Qué valor tiene prioridad si está en los dos lugares: a confirmar (según la documentación de Netlify, normalmente gana `netlify.toml`).

## CORS del backend

El backend (Heroku) solo acepta orígenes listados en `CORS_ORIGINS`. Tiene que incluir el dominio de Netlify, separado por comas:

```bash
heroku config:set CORS_ORIGINS=https://<sitio>.netlify.app,http://localhost:4200
```

(Si se usa dominio propio, agregarlo también.) Formato exacto del separador: ver `backend/src/config/env.validation.ts`.

## Verificar

1. Panel de Netlify → Deploys: buscar el commit pusheado y confirmar que el estado sea "Published".
2. Abrir `https://<sitio>.netlify.app` y hacer login con Google (Firebase Auth).
3. En DevTools → Network, revisar que las peticiones vayan a `https://odell-dashboard-api-bf200c02a0c9.herokuapp.com/api`.

## Deploy manual (excepcional)

Los scripts del repo publican con Netlify CLI, sin pasar por GitHub. Requieren `npx netlify-cli login` y el sitio vinculado:

```bash
npm run frontend:deploy          # producción
npm run frontend:deploy:preview  # URL de preview
```

Lo normal es no usarlos: pushear `main` alcanza.

## Firebase Hosting (no se usa)

El proyecto `dashboard-odell-2` quedó sin contenido en Hosting (da 404). `firebase.json` y `.firebaserc` son restos del esquema anterior y no se usan para publicar.

Esto no afecta a **Firebase Storage** ni a **Firebase Auth** del mismo proyecto: siguen en uso (archivos subidos, login). Ver `docs/FIREBASE.md`.

## Archivos relevantes

| Archivo | Rol |
|---------|-----|
| `netlify.toml` | Build, publish, redirects, headers y `API_URL` |
| `frontend/scripts/prepare-env.mjs` | Genera los `environment*.ts` con `API_URL` |
| `frontend/angular.json` | `fileReplacements` → environment de producción |
