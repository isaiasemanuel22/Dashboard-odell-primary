---
paths:
  - "backend/**"
---

# Backend (NestJS + Prisma)

- Cada funcionalidad nueva en su propio módulo Nest.
- No sumar enums fijos del rubro (`ServiceType`, `ProductType`, categorías de
  insumo).
- Persistencia: el estado vive en `store/` y se guarda vía
  `store/store-persistence.service.ts`. Schema en `backend/prisma/schema.prisma`;
  en local, `npm run db:push`.
- Tests con Jest, specs junto al código: `npm test --prefix backend`.
- Lint: `npx eslint "src/**/*.ts"` en `backend/`, sin `--fix`.
- Lockfile: ver `.claude/rules/git-y-deploy.md` (siempre npm 10.9.9).
