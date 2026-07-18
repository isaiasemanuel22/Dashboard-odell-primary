# Odell Dashboard

Dashboard para un emprendimiento de **impresión 3D** y **estampados**. Incluye backend en NestJS y frontend en Angular.

## Estructura

```
dashboard/
├── backend/    # API REST con NestJS (puerto 3000)
└── frontend/   # Dashboard web con Angular (puerto 4200)
```

## Funcionalidades

- **Dashboard**: métricas de ingresos, pedidos, cola de trabajo y stock
- **Pedidos**: gestión de pedidos de impresión 3D y estampado
- **Cola de trabajo**: estado de impresoras, plotters y prensas
- **Productos**: catálogo de servicios
- **Clientes**: base de clientes
- **Materiales**: inventario de filamentos, tintas e insumos

## Requisitos

- Node.js 20+
- npm
- MySQL 8+ o MariaDB 10+ (para persistencia)

## Cómo ejecutar

### 0. Base de datos MySQL (primera vez)

1. Crear base y usuario (ver `backend/scripts/setup-mysql.sql`).
2. Copiar variables de entorno:

```bash
cd backend
cp .env.example .env
```

3. Editar `.env` con tu `DATABASE_URL`:

```env
DATABASE_URL="mysql://odell:TU_PASSWORD@localhost:3306/odell_dashboard"
```

4. Crear tablas:

```bash
npm run db:push
```

5. Iniciar el backend: si la base está vacía, carga automáticamente los datos demo.

### 1. Backend (NestJS)

```bash
cd backend
npm install
npm run start:dev
```

La API queda disponible en `http://localhost:3000/api`

### 2. Frontend (Angular)

En otra terminal:

```bash
cd frontend
npm install
npm start
```

Abrir `http://localhost:4200`

> El frontend usa un proxy hacia el backend en desarrollo (`/api` → `localhost:3000`).

## Endpoints principales

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/dashboard/stats` | Estadísticas del dashboard |
| GET | `/api/products?type=fdm\|resina\|estampado` | Listado de productos |
| POST | `/api/products` | Crear producto |
| PATCH | `/api/products/:id` | Editar producto |
| DELETE | `/api/products/:id` | Eliminar producto |
| GET | `/api/categories?type=` | Categorías (filtrables por tipo) |
| POST | `/api/categories` | Crear categoría |
| POST | `/api/upload` | Subir imagen (multipart/form-data) |
| GET | `/api/orders` | Listado de pedidos |
| GET | `/api/customers` | Clientes |
| GET | `/api/print-jobs` | Cola de trabajo |
| GET | `/api/materials` | Inventario de materiales |

## Notas

- Los datos se persisten en **MySQL** (Prisma). Sin `DATABASE_URL` la app arranca en memoria (no guarda cambios).
- **Firebase** (opcional): login + imágenes en la nube. Ver [docs/FIREBASE.md](docs/FIREBASE.md).
- **Deploy frontend**: Firebase Hosting. Ver [docs/DEPLOY-FRONTEND.md](docs/DEPLOY-FRONTEND.md).
- Varias PCs pueden usar la misma API; los cambios se sincronizan en tiempo real (SSE).
- Subidas de imágenes siguen en la carpeta `backend/uploads/` (no en la DB).
- Scripts útiles en `backend/`: `npm run db:push`, `npm run db:migrate`, `npm run db:studio`.
