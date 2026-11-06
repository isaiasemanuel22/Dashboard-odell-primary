# Rediseño mobile · reglas de implementación

Reglas para implementar las pantallas mobile (≤768 px) de Odell. Valen para
cualquier tarea del rediseño; los briefs de cada pantalla solo agregan lo
específico.

## Referencias

- Artboards aprobados: `docs/mobile/artboards/Mob*.dc.html` (390 px de ancho).
  Son HTML estático: tomá de ahí estructura, textos, tamaños, colores y radios.
  Ignorá `<x-dc>`, `<helmet>`, `support.js` y el bloque `<script type="text/x-dc">`.
  Los datos de los artboards son de ejemplo: en la app van los reales.
- Clases compartidas de los artboards: `docs/mobile/estilos-compartidos.css`.
- Tipografía: la de la app (Inter), no Ubuntu.
- Pantallas ya migradas como referencia de código: `pages/dashboard`,
  `pages/orders` (lista, filtros, detalle, formulario), `pages/wallet`,
  `pages/products`, `pages/more`.

## Piezas compartidas

- `db-mobile-bar` (`components/mobile-bar`): barra superior con título,
  `backLink`, `showMenu` y slot de acciones (`m-ib` 44×44).
- Clases `m-*` en `shared/styles/_mobile-kit.scss`: `m-body`, `m-card`,
  `m-card--flush`, `m-row`, `m-kpis`, `m-kpi`, `m-sec-t`, `m-pill` (+ variantes),
  `m-tools`, `m-search`, `m-fbtn`, `m-chips`, `m-chip`, `m-chip--on`, `m-ib`.
- Tokens en `shared/styles/_mobile.scss` (`mobile.$m-*`) y mixins
  `mobile.mobile-only` / `mobile.desktop-only`.
- Clases `.mobile-only` / `.desktop-only`: `.mobile-only` solo oculta en
  desktop; en mobile cada elemento conserva su propio `display`.
- Modales de `FormDialogService`: en mobile salen como hoja inferior (manija,
  radio 20, pie fijo). Formularios grandes pueden ir a pantalla completa como el
  de pedido (`form-dialog-panel--order-fullscreen`).
- Hojas propias de una página (menús de acciones, mini selectores): llamar
  `LayoutUiService.pushOverlay()` al abrir y `popOverlay()` al cerrar (y en
  `ngOnDestroy`), para que el menú inferior no las tape.
- Pantallas con barra fija de acciones abajo: ocultar el menú inferior global
  agregando la ruta a `shouldHideBottomNav` en `layout/layout.component.ts`.
- Estado de listas al volver del detalle (filtros, búsqueda, scroll):
  `MobileListStateService` + `injectMobileListPersistence` en
  `core/services/mobile-list-state.service.ts`.

## Estrategia por pantalla

- Desktop (≥769 px) NO cambia: el markup actual se envuelve en `desktop-only`
  sin modificarlo y se agrega un bloque `mobile-only` que reusa los mismos datos.
- Un subcomponente que se usaría en los dos bloques se monta una sola vez según
  `BreakpointService.isMobile()` (`core/services/breakpoint.service.ts`), con
  `@if`, para no duplicar ids ni cargas.
- Formularios y acciones existentes se reusan (mismos métodos y validaciones);
  no se inventan acciones nuevas.

## Reglas de negocio y código

- No duplicar cálculos ni reglas: reusar helpers de `shared/utils` (pedidos,
  saldos, atraso, márgenes, stock, plurales) y lo que ya calcula cada pantalla.
- Margen siempre sobre el costo: (precio − costo) ÷ costo.
- Textos en español rioplatense.
- Accesibilidad: botones reales, `aria-label` en botones de ícono, toques
  ≥44 px, `role="switch"` + `aria-checked` en interruptores.

## No duplicar: modularizar

- Antes de escribir markup o estilos mobile, buscá si ya existe un componente
  `db-mobile-*` en `frontend/src/app/components/` o una clase `m-*` en
  `_mobile-kit.scss` que lo resuelva. Si existe, usalo; no copies su markup.
- Si un patrón aparece en 2 pantallas o más (barra fija de acciones, hoja
  inferior, buscador + chips, tarjeta de lista, totales, sección plegable,
  stepper, segmentado, fila de catálogo…), va a un componente compartido en
  `components/mobile-*` (standalone, `OnPush`, inputs/outputs tipados, estilos
  propios) y las pantallas lo consumen. Nada de clases con prefijo de página
  (`od-m__dock`, `qd-m__dock`…) que repitan lo mismo con otro nombre.
- La lógica repetida (estado de listas al volver, `pushOverlay/popOverlay`,
  formateos) va a un servicio o helper genérico, no copiada por pantalla.
- Guía de qué extraer y dónde se repite hoy: `docs/mobile/familias.md`
  (parte 2). Al terminar una extracción, actualizá la sección «Si cambiás X,
  tocá» de esa familia.
- Al reemplazar código por un componente compartido, el resultado visual y el
  comportamiento tienen que quedar idénticos, y desktop no cambia.

## CSS

- Nunca `font: <peso> <tamaño> inherit;` (es inválido y el navegador descarta
  la declaración). Usar `font-family: inherit; font-size: …; font-weight: …;`.
- Cuidado con la especificidad: estilos de componentes encapsulados y reglas
  globales como `.modal input:not(...)` pueden ganarle a una regla mobile; si no
  aplica, subirle especificidad.

## Antes de terminar una tarea

- `npx ng build` en `frontend/` sin errores.
- `grep -rn "font: [0-9][^;]*inherit;" frontend/src` sin resultados.
- `CHROME_BIN=/usr/bin/google-chrome npx ng test --watch=false --browsers=ChromeHeadless` en verde.
- No correr `git commit/add/stash` ni nada que modifique git.
- No hacer revisión visual en el navegador.
- Responder con archivos tocados, decisiones y cualquier función que quede
  inaccesible en mobile.
