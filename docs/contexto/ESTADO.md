# Estado de Odell — al 2026-11-16

Se reescribe cuando cambia algo (ver reglas en `CLAUDE.md`). Historia: `docs/contexto/BITACORA.md`.

## Producción
- GitHub `main` = `feat/insumo-margen-error` en `02dbe97` (2026-11-16: insumos a
  costo × 2 + margen de error, §16.3). Heroku v46 = `02dbe97` (sin cambios de
  esquema). Netlify ya sirve el frontend nuevo. APK TWA publicada; assetlinks verificado.
  Netlify publica el frontend solo al pushear `main`.
- Orden de deploy: push a origin → push a heroku → recién después
  `npm run db:push:heroku` si hubo cambios de esquema. Nunca ACCEPT_DATA_LOSS.
- El worktree `../dashboard-rediseno` tiene `main` tomado: pushear con
  `git push origin HEAD:main` y `git push heroku HEAD:main`.

## Ramas y trabajo en curso
- Rama actual: `fix/barrido-errores` (sale de `main`): barrido de errores de toda la
  app, verificado con tests y tester, **sin deploy**. Backend suma `helmet` (npm ci
  en Heroku) y no cambia el esquema. Ver bitácora 2026-11-16.
- APK en `~/Escritorio/Odell.apk`; falta probarla en un teléfono. Para regenerar:
  `android-twa/` + Bubblewrap; JDK, SDK y clave de firma en `~/.odell-android`
  (perder la clave = no se puede actualizar la app).
- Precios de catálogo guardados no se recalcularon con la regla de insumos × 2 +
  margen de error ni con la lista de combos: cada producto con insumos los toma
  al usar «Usar precio calculado» o «Actualizar precios».
- Errores reportados: corregidos hasta E135 (en la rama); E132 sin reproducir; E136–E138 pendientes.
- Productos de Estampado con precio fijo guardados antes de `ce64767` tienen la
  lista sin insumos: se corrigen al volver a guardarlos.
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
- Planilla «Odell — Seguimiento» para el agente `seguimiento`: crearla en Drive
  (hojas Insumos, Competencia, Tendencias) y cargar su ID en
  `~/.claude/agents/seguimiento.md`.
- Nano Banana sin API key de Gemini (`~/.config/nano-banana/api-key` o
  `GEMINI_API_KEY`): la carga Isaías; sin eso no se generan imágenes.

## Por definir (preguntar a Isaías antes de tocar)
- ¿Un presupuesto borrador sin líneas puede pasar a Rechazado/Cancelado? Hoy sí.
- ¿Se puede vender por encima del stock? Hoy el stepper se limita al stock.
- ¿Aviso al salir de Ajustes con cambios sin guardar?
- ¿Se puede editar un pedido ENTREGADO o CANCELADO (ítems, total)? Hoy sí; solo se
  impide bajar una cantidad por debajo de lo entregado.
- ¿Se puede cancelar un pedido ENTREGADO, y qué pasa con el stock ya descontado?
- Permisos en el backend: hoy cualquier usuario activo puede cambiar márgenes,
  Ajustes, borrar productos o cargar egresos (§16.2 y §22 dicen otra cosa). ¿Alcance?
- Calendario: repetición mensual un día 29–31 (hoy no aparece en meses cortos) y
  completar un recordatorio repetido (hoy se completa en todas las fechas).
- Precio fijo en FDM/Estampado: hoy suma insumos × 2 + error encima del fijo; §16.1.3
  solo lo define para combos.
- Esc en un formulario con datos (Billetera) cierra sin confirmar; tocar afuera en
  Proveedor sí confirma. ¿Unificar?
- Diseño v3 (merch): ¿la seña es obligatoria (50% desde 20 prendas) y frena
  la producción? Choca con §Pagos de BUSINESS-RULES, donde la seña no tiene efectos.

## Entorno local
- Dev server: launch `odell-dev-4300` (el 4200 lo usa otro proyecto).
- Cada worktree con backend propio necesita base aparte: si comparten la
  base local, se pisan los datos.
- Datos de QA en la base local: cust-2 «QA Revendedor», pedidos ord-13 a
  ord-29, presupuesto quo-18, producto prod-45 «QA taza ×2».
