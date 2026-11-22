# Estado de Odell — al 2026-11-22

Se reescribe cuando cambia algo (ver reglas en `CLAUDE.md`). Historia: `docs/contexto/BITACORA.md`.

## Producción
- GitHub `main` = `feat/sync-instantanea` en `131594c` (2026-11-22: cambios al instante entre
  pantallas con SSE, activada por defecto, §25.11; antes v6 fase 1 §29 y Chats/Meta §28).
  Heroku v54 = `131594c`, sin cambios de esquema desde v53. Netlify publica el frontend solo
  al pushear `main`.
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
- v6 fase 2 Mercado Pago: `feat/v6-mercadopago` en `4727d47` (worktree `../dashboard-v6`, dev
  `odell-v6-4500`, usa la base local `odell_dashboard`), sin publicar. Espera que Isaías cargue
  `MP_ACCESS_TOKEN` (cuenta vendedor de prueba) en `backend/.env`; después túnel cloudflared,
  URL del webhook → `MP_WEBHOOK_SECRET`, probar link/seña/QR. Al publicar: aplicar
  `payment_links` (`db:push:heroku`) y plantilla Meta `link_de_pago`. Siguen fase 3 Tiendanube y
  fase 4 ARCA. Falta: avisar por Meta a un cliente sin chat, botón wa.me viejo en presupuesto,
  paridad mobile (Productos sin Carrito/Actualizar precios/+Categoría; escritorio sin «Con saldo»).
- `feat/3mf-placas` en `7baf2cb` (worktree `../dashboard-3mf`, §30): elegir placa del .3mf y
  «Generar todas las placas» + combo. Sin publicar; falta probar con un .gcode.3mf real de Isaías.
- Sync instantánea publicada; falta: token vencido con stream abierto sigue hasta cortarse;
  con más de un dyno haría falta Redis.
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
- Los worktrees usan la base local `odell_dashboard` (pedido de Isaías, 2026-11-21): lo que se carga
  en uno aparece en los otros. Dev de la sync: `odell-sync-4600` (`../dashboard-sync`).
- Datos de QA en la base local: ferias fair-1 a fair-4 «Feria Plaza España» (cerradas)
  y fair-5 «Mercado de Diseño Güemes» (abierta, 2026-11-17); cust-2 «QA Revendedor», pedidos ord-13 a
  ord-29, presupuesto quo-18, productos prod-45 «QA taza ×2» (con packaging) y prod-53 «QA sin mano de obra»;
  packaging: insumo sup-5 «QA Caja kraft», combo prod-54, pedidos ord-66/ord-67, presupuesto qpe-37.
- La base local está al día con el esquema de `feat/v6-mercadopago` (v6, Chats/Meta, packaging,
  `payment_links`), aplicado con SQL aditivo el 2026-11-21. Clientes QA «QA Sync SSE» y
  «QA Sync reconexion».
