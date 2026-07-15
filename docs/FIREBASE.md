# Firebase + Auth + Storage

Guía para activar **login** y **imágenes en la nube** con Firebase.

## 1. Crear proyecto en Firebase

1. Entrá a [Firebase Console](https://console.firebase.google.com/).
2. **Agregar proyecto** (plan Spark / gratuito alcanza para empezar).
3. Registrá una **app Web** y copiá el objeto `firebaseConfig`.

## 2. Frontend

Editá `frontend/src/environments/environment.ts` (y `environment.prod.ts` en producción):

```typescript
firebase: {
  apiKey: '...',
  authDomain: '....firebaseapp.com',
  projectId: '...',
  storageBucket: '....firebasestorage.app',
  messagingSenderId: '...',
  appId: '...',
},
```

## 3. Authentication (login)

En Firebase Console → **Authentication**:

1. Si es la primera vez, tocá **Comenzar** / **Get started** (sin esto aparece `auth/configuration-not-found`).
2. Pestaña **Sign-in method**:
   - Activá **Correo electrónico/Contraseña** (opcional).
   - Activá **Google** → elegí email de soporte → **Guardar**.
3. Pestaña **Settings** → **Authorized domains**: debe figurar `localhost`.

Con Google no hace falta crear usuarios a mano; se registran al primer login.

Al guardar las claves, la app redirige a `/login` antes de entrar al dashboard.

## 4. Storage (imágenes de productos, opcional)

Por defecto las imágenes se suben al **backend** (`backend/uploads/`), sin depender de Firebase Storage.

Para usar Firebase Storage en producción, en `environment.prod.ts`:

```typescript
productImageStorage: 'firebase',
```

En Firebase Console → **Storage** → **Get started**.

Reglas recomendadas (solo usuarios logueados pueden subir; todos pueden ver):

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /products/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

Las URLs públicas de Firebase se guardan en MySQL dentro de `products.images`.

## 5. Backend (validar tokens)

1. Firebase Console → **Project settings** → **Service accounts**.
2. **Generate new private key** → descargá el JSON.
3. Guardalo como `backend/firebase-service-account.json` (no subir a git).
4. En `backend/.env`:

```env
FIREBASE_SERVICE_ACCOUNT_PATH=firebase-service-account.json
```

Reiniciá el backend. Sin este archivo la API sigue abierta (modo desarrollo).

## 6. Comportamiento

| Componente | Sin Firebase configurado | Con Firebase |
|------------|-------------------------|--------------|
| Login | No se exige | Pantalla `/login` |
| Imágenes | Subida local `/uploads` (por defecto) | Firebase Storage solo si configurás `productImageStorage: 'firebase'` en el frontend **y** reglas/CORS de Storage |
| API | Sin token | Header `Authorization: Bearer …` |

## 7. Tiempo real (SSE)

El stream `/api/events/stream` queda público porque el navegador no envía headers custom en `EventSource`. El resto de la API sí requiere token cuando Firebase Admin está activo.

## Costos

Plan **Spark** (gratis): ~5 GB Storage, Auth ilimitado en uso normal de un taller. Revisá cuotas en la consola si crece mucho el catálogo.
