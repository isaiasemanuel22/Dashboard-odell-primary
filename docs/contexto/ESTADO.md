# Estado de Odell — al 2026-11-21

Se reescribe cuando cambia algo (ver reglas en `CLAUDE.md`). Historia: `docs/contexto/BITACORA.md`.

## Producción
- GitHub `main` = `feat/v6-integraciones` en `c333d5d` (2026-11-21: diseño v6 fase 1 §29 —
  Integraciones, factura C manual, comisión MP, Ventas con canal/neto/export — más Chats, Meta y
  agentes §28 que ya estaban en `07f5475`). Heroku v53 = `c333d5d`, esquema aplicado
  (`db:push:heroku` in sync). Netlify publica el frontend solo al pushear `main`.
- En producción ningún producto tiene el precio fijo guardado (antes no se persistía):
  volver a marcarlos como «Fijo» y guardarlos antes de usar «Recalcular precios».
- Lockfile del backend: regenerarlo siempre con npm 10.9.9 (el de Heroku):
  `npx npm@10.9.9 install --package-lock-only --registry=https://registry.npmjs.org`.
  El npm local (11.x) y el registry configurado (almundo) rompen `npm ci` en Heroku.
- Orden de deploy: push a origin → push a heroku → recién después
  `npm run db:push:heroku` si hubo cambios de esquema. Nunca ACCEPT_DATA_LOSS.
- El worktree `../dashboard-rediseno` tiene `main` tomado: pushear con
  `git push origin HEAD:main` y `git push heroku HEAD:main`.

## Ramas y trabajo en curso
- Rama actual del v6: `feat/v6-integraciones` (worktree `../dashboard-v6`, dev `odell-v6-4500`,
  backend en memoria), igual a `main`. Siguen: fase 2 links de pago MP, fase 3 Tiendanube,
  fase 4 ARCA (Isaías tiene las tres cuentas; claves en `.env`, nunca en el chat). Falta: avisar
  por Meta a un cliente sin chat (hoy solo copiar), botón wa.me viejo en presupuesto, paridad
  mobile (Productos sin Carrito/Actualizar precios/+Categoría; escritorio sin «Con saldo»).
- `feat/chats` y `claude/meta-agentes-3d0324` ya unidas a `main` y publicadas (2026-11-20).
- Pendiente de `feat/margen-total-listado`: «productos afectados» de un insumo sin packaging;
  `product-detail`, `product-pricing` y márgenes por canal del Dashboard con otras fórmulas.
- `feat/ferias` ya unida a `main` (publicada 2026-11-18). Falta probar
  Ferias en producción con sesión iniciada; sin UI para editar feria, fondo o gastos.
- Producción con sesión iniciada sin revisar (el agente solo vio el login).
- APK en `~/Escritorio/Odell.apk`; falta probarla en un teléfono. Para regenerar:
  `android-twa/` + Bubblewrap; JDK, SDK y clave de firma en `~/.odell-android`
  (perder la clave = no se puede actualizar la app).
- Precios de catálogo guardados no se recalcularon con la regla de insumos × 2 +
  margen de error ni con la lista de combos: cada producto con insumos los toma
  al usar «Usar precio calculado» o «Actualizar precios».
- Errores reportados: corregidos hasta E135; E132 sin reproducir; E136–E146 pendientes (E139–E146 de la ronda 2026-11-21).
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
- ¿Aviso al salir de Ajustes con cambios sin guardar? (Integraciones ya avisa, también en escritorio.)
- ¿Responsable obligatorio al crear un pedido? (desde presupuesto se crea sin, E139.)
- ¿El balance por área descuenta comisiones? (E140)
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
- Chats: plantillas de WhatsApp fuera de la ventana de 24 h, cómo se cuentan los no
  leídos, botón «Respuestas rápidas» del encabezado y sus textos (hoy `[completar]`),
  seña/entrega en la sugerencia del agente.


## Entorno local
- Dev server: launch `odell-dev-4300` (el 4200 lo usa otro proyecto).
- Cada worktree con backend propio necesita base aparte: si comparten la
  base local, se pisan los datos.
- Datos de QA en la base local: ferias fair-1 a fair-4 «Feria Plaza España» (cerradas)
  y fair-5 «Mercado de Diseño Güemes» (abierta, 2026-11-17); cust-2 «QA Revendedor», pedidos ord-13 a
  ord-29, presupuesto quo-18, productos prod-45 «QA taza ×2» (con packaging) y prod-53 «QA sin mano de obra»;
  packaging: insumo sup-5 «QA Caja kraft», combo prod-54, pedidos ord-66/ord-67, presupuesto qpe-37.
- La base local NO tiene las columnas del v6 ni las de Chats/Meta: script `backend/scripts/sql/v6-integraciones.sql`.
- La base local ya tiene las columnas de packaging (agregadas a mano: `prisma db push`
  borraría las tablas de Chats, que no están en esta rama).
