# Brief del diseñador: rediseño de las piezas que faltaban

Diseñás artboards en el lienzo de Odell siguiendo patrones que el usuario ya
aprobó. No decidís funciones: dibujás lo que la app ya hace hoy, con el
estilo nuevo.

## Lienzo

- URL: `https://claude.ai/artifact/Xoad313w4HCRvMk24cFW5S` (tipo «Design»).
- Antes de publicar por primera vez: `Artifact` con `action: "read"` y la `url`
  (sin path). Si una publicación se rechaza porque hay una versión nueva,
  repetí esa lectura y volvé a publicar el mismo archivo.
- Carpeta raíz local (`root`):
  `/tmp/claude-1001/-home-icalfin-Escritorio-Proyectos-dashboard/26fb1cfe-00ed-427e-8750-679c6590b41b/scratchpad/canvas`.
  Cada artboard va en `<root>/project/<Nombre>.dc.html`.
- Publicá **un archivo por llamada**:
  `{url, root, file_path: "<root>/project/<Nombre>.dc.html"}`. Escribí uno,
  publicalo y recién después escribí el siguiente.
- **No mandes `project/canvas.json`**: lo publica el orquestador al final.
- No verifiques el render (nada de navegador ni capturas) y no leas de vuelta
  lo que publicaste.

## Referencias que tenés que copiar (leelas antes de empezar)

En `<root>/project/` ya están:

- `RdPatrones.dc.html`: los patrones aprobados.
  - §1: modal de formulario (clases `.modal .mh .mt .x .mb .mf`, campos `.field`).
  - §2: confirmación (`.cf .ic .ic-w/.ic-i .cft .cfp`, `.btn-d` solo si borra o
    no se puede deshacer).
  - §3: panel de filtros (`.trig .cnt .pop .pgp .pgt`, chips `.achip`, switch `.sw`).
- `RdCola.dc.html`: página con barra lateral (`.app .side .main .wrap .head
  .bar .chips .achip .search`) y su bloque NAV en `renderVals()`.
- `RdVentaMostrador.dc.html`: modal grande de dos columnas (`.seg`, `.step`,
  totales).

Para mobile, leé con `Artifact` `read` (`url` + `paths`) como referencia de
hoja inferior: `project/MobRegistrarPago.dc.html`, `project/MobInsumoForm.dc.html`
y `project/MobNuevoEvento.dc.html`. Usan el CSS
`/_blob/8d80655a3ce2fd18937d7dfc20caabc4` (clases `.ph .ghost .scrim .sheet
.grab .sh .sb .sfoot .field .fl .inp .seg .opts .opt .two .ln .hint .num .sw
.btn .btn-p .ib`).

Las reglas de forma son las de los archivos de referencia: misma cabecera
(`<script src="./support.js"></script>`, la hoja `/_blob/...`, la fuente
Ubuntu en `<helmet>`), `<x-dc>`, bloque `<script type="text/x-dc"
data-dc-script>` con `class Component extends DCLogic` y `$preview` igual al
tamaño del artboard. Además:

- Cerrá todos los elementos y poné comillas en todos los atributos.
- Los `{{hueco}}` son búsquedas simples en `renderVals()`, nunca expresiones.
- Íconos: SVG inline de trazo, nunca emoji.
- Usá `<button>`, `<label>` e `<input>` reales y `aria-label` en los botones
  que son solo ícono.
- Desktop: modal sobre fondo `#3B4A55`, 1440 de ancho.
- Mobile: 390×844.
- Textos en español rioplatense, con datos verosímiles de Odell (productos
  como «Llavero corporativo 3D», «Taza Frozen», «Remera estampada DTF»;
  clientes como «María González» o «Café Aurora»; montos `$ 12.400`).
  Nada de lorem ipsum.

## Contenido: sacalo del código real

Antes de cada artboard, leé el template del componente en
`/home/icalfin/Escritorio/Proyectos/dashboard/frontend/src/app/` para saber
qué campos, opciones, botones y textos tiene hoy. Dibujá exactamente esas
funciones, sin agregar ni sacar. Si algo no se entiende, anotalo en tu
reporte y no lo inventes.

## Tanda A: desktop

1. `RdPedidoDetalle.dc.html` (1440×1100, página con barra lateral y raíz fluida
   como RdCola). Sale de `pages/orders/order-detail/` (`order-detail.component.html`
   y sus subcomponentes: pagos, entregas, etc.). Como guía de estilo, mirá
   `project/V3PedidoDetalle.dc.html`, pero solo dibujá lo que existe hoy.
2. `RdFiltros.dc.html` (1440×1000): un panel por cada filtro con el patrón §3,
   en grilla: presupuestos, ventas, productos, cola y calendario
   (`modals/quote-filters-sheet`, `sale-filters-sheet`, `product-filters-sheet`,
   `print-job-filters-sheet`, `calendar-filters-sheet`). El de pedidos ya está
   en RdPatrones.
3. `RdSelectorPiezas.dc.html` (1440×900): modal de `components/product-piece-picker`.
4. `RdImpreso.dc.html` (1440×900): modal de `modals/impreso-form-dialog` (mirá
   también `pages/settings/impresos-settings/impreso-form`).
5. `RdModalesChicos.dc.html` (1440×1200): cuatro modales en grilla 2×2:
   - tarea independiente (`modals/independent-task-dialog`; guía de estilo:
     `project/V2ModalTarea.dc.html`);
   - exportar presupuesto (`modals/quote-document-export-dialog`);
   - pago de cuenta (`pages/wallet/components/wallet-repayment-form`);
   - días de la semana (`modals/calendar-event-weekdays`).

## Tanda B: mobile (hojas inferiores, 390×844)

1. `MobRdConfirmacion.dc.html`: confirmación genérica (`modals/confirm-dialog`),
   con el ejemplo «Anular movimiento» (`wallet-void-form`).
2. `MobRdReemplazoInsumo.dc.html`: `modals/supply-replacement-dialog`.
3. `MobRdTarea.dc.html`: tarea independiente.
4. `MobRdExportarPdf.dc.html`: exportar presupuesto.
5. `MobRdPagoCuenta.dc.html`: pago de cuenta.
6. `MobRdSelectorPiezas.dc.html`: selector de piezas a pantalla completa (barra
   superior como `MobNuevaVenta`).
7. `MobRdCategoria.dc.html`: nueva categoría.
8. `MobRdImpreso.dc.html`: nuevo impreso.
9. `MobRdDiasSemana.dc.html`: días de la semana para repetir un evento.

## Reporte final (corto)

- Qué artboards publicaste.
- Qué funciones dibujaste en cada uno.
- Qué dudas quedaron.
