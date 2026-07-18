# Deploy del frontend (Firebase Hosting)

El frontend Angular se publica en **Firebase Hosting** del proyecto `dashboard-odell-2`.

URL esperada tras el deploy: `https://dashboard-odell-2.web.app`

## Requisitos

- Node.js 20+
- Cuenta con acceso al proyecto Firebase `dashboard-odell-2`
- Firebase CLI (se instala con el `npm install` de la raíz del repo)

## 1. Instalar dependencias (una vez)

Desde la raíz del repo:

```bash
npm install
cd frontend && npm install
```

## 2. Login en Firebase (una vez por máquina)

```bash
npx firebase login
```

## 3. URL del backend en producción

El build de producción necesita saber dónde está el API. Pasá la variable **`API_URL`** al compilar:

```bash
export API_URL=https://TU-SERVIDOR:3000/api
```

Si no la definís, queda `http://localhost:3000/api` (solo útil para pruebas locales del build).

Cuando el backend tenga URL pública, agregá ese origen en `backend/.env`:

```env
CORS_ORIGINS=https://dashboard-odell-2.web.app,http://localhost:4200
```

## 4. Deploy

### Opción A — desde la raíz

```bash
export API_URL=https://TU-SERVIDOR:3000/api
npm run frontend:deploy
```

### Opción B — desde `frontend/`

```bash
cd frontend
export API_URL=https://TU-SERVIDOR:3000/api
npm run deploy
```

### Preview temporal (7 días)

```bash
npm run frontend:deploy:preview
```

Genera una URL tipo `https://dashboard-odell-2--preview-xxxxx.web.app`.

## 5. Verificar

1. Abrí `https://dashboard-odell-2.web.app`
2. Login con Google (Firebase Auth)
3. Revisá en DevTools → Network que las peticiones vayan a tu `API_URL`

## Archivos relevantes

| Archivo | Rol |
|---------|-----|
| `firebase.json` | Hosting: carpeta `frontend/dist/frontend/browser`, SPA rewrite |
| `.firebaserc` | Proyecto Firebase |
| `frontend/scripts/prepare-prod-env.mjs` | Genera `environment.prod.ts` con `API_URL` |
| `frontend/angular.json` | `fileReplacements` → environment de producción |

## Notas

- Solo se despliega el **frontend**. El backend sigue corriendo aparte (otro servidor, otra máquina, etc.).
- Las imágenes usan Firebase Storage desde el navegador vía backend (`POST /api/upload`).
- Para dominio propio: Firebase Console → Hosting → Add custom domain.
