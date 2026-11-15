# Estado de Odell — al 2026-11-15

Se reescribe cuando cambia algo (ver reglas en `CLAUDE.md`). Historia: `docs/contexto/BITACORA.md`.

## Producción
- GitHub `main` = `feat/apk-twa` (APK de Android, TWA), 2026-11-15, solo
  frontend; assetlinks verificado por Google. Heroku = `8a7f8fc` (descuento de producto, v43; sin cambios de
  backend después). Netlify publica el frontend solo al pushear `main`.
- Orden de deploy: push a origin → push a heroku → recién después
  `npm run db:push:heroku` si hubo cambios de esquema. Nunca ACCEPT_DATA_LOSS.
- El worktree `../dashboard-rediseno` tiene `main` tomado: pushear con
  `git push origin HEAD:main` y `git push heroku HEAD:main`.

## Ramas y trabajo en curso
- Rama actual: `feat/apk-twa`, igual a `main`. APK en `~/Escritorio/Odell.apk`;
  falta probarla en un teléfono. Para regenerar: `android-twa/` + Bubblewrap; JDK, SDK y clave de
  firma en `~/.odell-android` (perder la clave = no se puede actualizar la app).
- Precios de catálogo guardados no se recalcularon con la regla de insumos +50 % ni
  con la nueva lista de combos (suma de precios de piezas):
  cada producto con insumos los toma al usar «Usar precio calculado» o
  «Actualizar precios».
- Errores reportados: todos corregidos (E1–E123) en `docs/qa/errores-pendientes.md`.
- Ramas viejas ya unidas (borrables con OK): feat/3mf-purga,
  feat/bobinas-reposicion, feat/cola-por-impresora, feat/rediseno-faltantes,
  fix/errores-tanda-1, docs/deploy-netlify.

## Pendientes
- Validar el lector .3mf con un archivo real de Bambu Studio (sobre todo si
  `used_g` ya incluye la purga, función `mapUsedGrams`).
- Hallazgos de severidad baja del reporte de verificación y dependencias con
  vulnerabilidades: https://claude.ai/artifact/QfUJqDSWi6QttTkSU4512S
- Después: quitar enums `FilamentType`, `ResinType`, `PaperType` y
  `DEFAULT_PROFIT_MARGINS` (rama propia) y separar la app en módulo base +
  módulos opcionales (ver ODELL.md «Rumbo»).
- Decidir si `odell-qa-visual` pasa a sonnet (hoy hereda Opus).

## Por definir (preguntar a Isaías antes de tocar)
- ¿Un presupuesto borrador sin líneas puede pasar a Rechazado/Cancelado? Hoy sí.
- ¿Se puede vender por encima del stock? Hoy el stepper se limita al stock.
- ¿Aviso al salir de Ajustes con cambios sin guardar?

## Entorno local
- Dev server: launch `odell-dev-4300` (el 4200 lo usa otro proyecto).
- Cada worktree con backend propio necesita base aparte: si comparten la
  base local, se pisan los datos.
- Datos de QA en la base local: cust-2 «QA Revendedor», pedidos ord-13 a
  ord-29, presupuesto quo-18.
