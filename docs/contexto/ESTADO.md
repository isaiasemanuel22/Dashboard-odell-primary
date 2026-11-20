# Estado de Odell — al 2026-11-19

Se reescribe cuando cambia algo (ver reglas en `CLAUDE.md`). Historia: `docs/contexto/BITACORA.md`.

## Producción
- GitHub `main` = `fix/mano-de-obra-opcional` en `03e7e64` (2026-11-18: mano de
  obra opcional, §3; antes, módulo Ferias v4, §26). Heroku v49 = `03e7e64`,
  esquema de Ferias aplicado (`fairs`, `retail_sales.fair_id`).
  Netlify ya sirve el frontend nuevo. APK TWA publicada; assetlinks verificado.
  Netlify publica el frontend solo al pushear `main`.
- Lockfile del backend: regenerarlo siempre con npm 10.9.9 (el de Heroku):
  `npx npm@10.9.9 install --package-lock-only --registry=https://registry.npmjs.org`.
  El npm local (11.x) y el registry configurado (almundo) rompen `npm ci` en Heroku.
- Orden de deploy: push a origin → push a heroku → recién después
  `npm run db:push:heroku` si hubo cambios de esquema. Nunca ACCEPT_DATA_LOSS.
- El worktree `../dashboard-rediseno` tiene `main` tomado: pushear con
  `git push origin HEAD:main` y `git push heroku HEAD:main`.

## Ramas y trabajo en curso
- Rama actual: `feat/packaging` (sale de `main` `0c4fb6f`, sin publicar): packaging §27
  (categoría de insumo, sección en producto/pedido/presupuesto, × 1,25, stock al entregar).
  Al publicar hace falta `db:push:heroku` (`products.suggested_price`, `products.packaging_supplies`,
  `products.sum_pieces_packaging`, `order_items.packaging_supplies`, `quote_items.packaging_supplies`).
  Falta: descuento en venta de mostrador (regla por definir) y que el aviso de «productos
  afectados» de un insumo cuente el packaging.
- En la misma rama: precio fijo = precio final en todos los tipos (§16.1.1); margen del proceso
  vs objetivo y margen total aparte; el precio fijo ahora se guarda (`products.suggested_price`,
  antes no se persistía). Al publicar: `db:push:heroku` también por esa columna, y en producción
  ningún producto tiene el fijo guardado: hay que volver a marcarlos antes de usar «Recalcular precios».
- `feat/chats` (sin publicar): sección Chats v7; necesita `db:push:heroku` (tablas de chats).
  La sesión de Meta (`claude/meta-agentes-3d0324`) depende de esa rama.
- `feat/ferias` ya unida a `main` (publicada 2026-11-18). Falta probar
  Ferias en producción con sesión iniciada; sin UI para editar feria, fondo o gastos.
- Producción con sesión iniciada sin revisar (el agente solo vio el login).
- APK en `~/Escritorio/Odell.apk`; falta probarla en un teléfono. Para regenerar:
  `android-twa/` + Bubblewrap; JDK, SDK y clave de firma en `~/.odell-android`
  (perder la clave = no se puede actualizar la app).
- Precios de catálogo guardados no se recalcularon con la regla de insumos × 2 +
  margen de error ni con la lista de combos: cada producto con insumos los toma
  al usar «Usar precio calculado» o «Actualizar precios».
- Errores reportados: corregidos hasta E135 (en la rama); E132 sin reproducir; E136–E138 pendientes.
- Ramas viejas ya unidas (borrables con OK): feat/3mf-purga,
  feat/bobinas-reposicion, feat/cola-por-impresora, feat/rediseno-faltantes,
  fix/errores-tanda-1, docs/deploy-netlify.

## Pendientes
- Reglas de Claude en `.claude/rules/` y skills `interrogar-plan` y `revisar-ui`
  en `.claude/skills/` (2026-11-17): probar en una sesión nueva (`/memory`, y
  que las skills aparezcan).
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
- Esc en un formulario con datos (Billetera) cierra sin confirmar; tocar afuera en
  Proveedor sí confirma. ¿Unificar?
- Diseño v3 (merch): ¿la seña es obligatoria (50% desde 20 prendas) y frena
  la producción? Choca con §Pagos de BUSINESS-RULES, donde la seña no tiene efectos.

- Packaging: ¿la venta de mostrador descuenta packaging y lo devuelve al editar/borrar la venta?

## Entorno local
- Dev server: launch `odell-dev-4300` (el 4200 lo usa otro proyecto).
- Cada worktree con backend propio necesita base aparte: si comparten la
  base local, se pisan los datos.
- Datos de QA en la base local: ferias fair-1 a fair-4 «Feria Plaza España» (cerradas)
  y fair-5 «Mercado de Diseño Güemes» (abierta, 2026-11-17); cust-2 «QA Revendedor», pedidos ord-13 a
  ord-29, presupuesto quo-18, productos prod-45 «QA taza ×2» (con packaging) y prod-53 «QA sin mano de obra»;
  packaging: insumo sup-5 «QA Caja kraft», combo prod-54, pedidos ord-66/ord-67, presupuesto qpe-37.
- La base local ya tiene las columnas de packaging (agregadas a mano: `prisma db push`
  borraría las tablas de Chats, que no están en esta rama).
