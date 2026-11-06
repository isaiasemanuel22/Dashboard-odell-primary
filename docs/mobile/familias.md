# Mobile · familias de pantallas (QA y desarrollo)

Las 34 pantallas se agrupan en 8 familias + 2 únicas. En cada familia se revisa
el patrón completo una sola vez (pantalla representativa) y en las demás solo lo
que cambia. Ancho de prueba: 390 px. Rutas según `app.routes.ts`; las hojas y
formularios se abren desde la pantalla indicada.

## 0. Piezas compartidas (verificar una vez, en la primera ronda)

| Pieza | Dónde verificarla | Qué se mira |
|---|---|---|
| Barra superior `db-mobile-bar` | Pedidos (con menú), PedidoDetalle (con volver + acciones) | Alto, título, `backLink`, `m-ib` de 44×44, `aria-label`, acciones a la derecha |
| Menú inferior global | Pedidos, Más, Billetera | 5 ítems, activo resaltado, se oculta con overlay (`pushOverlay`) y en rutas de `shouldHideBottomNav` |
| Barra fija de acciones | PedidoDetalle | Fija abajo, sin tapar contenido (padding del cuerpo), menú inferior oculto |
| Hoja inferior (`FormDialogService`) | RegistrarPago | Manija, radio 20, pie fijo, cierre por fondo y botón, scroll interno, teclado |
| Formulario a pantalla completa | NuevoPedido | Encabezado con cerrar, secciones numeradas, pie fijo, sin menú inferior |
| Chips (`m-chip`, `m-chip--on`) | Pedidos | Scroll horizontal, contador, estado activo |
| Tarjetas (`m-card`, `m-row`, `m-pill`) | Pedidos y Ajustes | Radio, sombra/borde, pills de estado y colores |
| Buscador / `m-fbtn` | Pedidos | Alto 44, ícono, filtro con contador |
| Tokens y tipografía | Cualquiera | Inter (no Ubuntu), colores, toques ≥44 px |
| Desktop sin cambios | Pedidos a 1280 px | Nada de lo mobile se filtra al layout ≥769 px |

Después de esta ronda, en las demás pantallas **no** se repite nada de esto.

## Familia A · Lista con buscador, chips y tarjetas

Barra + (buscador/filtro) + chips + tarjetas apiladas + menú inferior.
Representativa: **Pedidos**.

Se chequea una vez (en Pedidos): barra con acción, buscador + botón filtros con
contador, chips con contadores y scroll, tarjeta con pill de estado y monto,
estado vacío, persistencia de filtros/búsqueda/scroll al volver del detalle,
tocar tarjeta navega al detalle.

| Pantalla | Ruta | Artboard | Solo chequear |
|---|---|---|---|
| Pedidos (rep.) | /pedidos | MobPedidos | Todo lo de arriba; "Atrasado N días" en rojo; seña/saldo; pills de área |
| Presupuestos | /presupuestos | MobPresupuestos | Chips Abiertos/Borrador/Enviado/Aceptado/Cerrados; texto "Falta cliente" en borrador; "Pedido ord-12 generado" en aceptado; sin botón de filtros |
| Clientes | /clientes | MobClientes | Avatar con iniciales; chips Revendedores/Empresas/Con saldo; "saldo" a la derecha solo si debe; chevron en el resto |
| Productos | /productos | MobProductos | Botón "Tipo y categoría"; banner de precios desactualizados + Recalcular; mini tabla Lista/Mayorista/Costo/Margen; margen negativo en rojo; "Precio fijo"; imagen vacía |
| Insumos | /insumos | MobInsumos | Chips FDM/Resina/Estampado/General; banner de stock bajo; cantidad con unidad y rojo si 0/bajo mínimo |
| Cola de trabajo | /cola | MobCola | Variante: 4 contadores arriba (Por hacer/En proceso/Revisión/Terminadas) + chips de área; tarjeta con prioridad, "Bloqueada", avatar asignado y botones Detalle/Empezar; sin buscador |

## Familia B · Detalle con tarjetas y barra fija de acciones

Barra con volver + pill de estado + tarjetas apiladas + barra fija inferior (menú
inferior global oculto). Representativa: **Detalle de pedido**.

Se chequea una vez (en PedidoDetalle): volver, tarjeta de cliente con
WhatsApp/Llamar, tarjeta de totales (Total/Pagado/Saldo), secciones colapsables
(Tareas, Entregas, Historial), barra fija sin tapar el último contenido, menú
inferior oculto, estado de carga/no encontrado.

| Pantalla | Ruta | Artboard | Solo chequear |
|---|---|---|---|
| Detalle de pedido (rep.) | /pedidos/:id | MobPedidoDetalle | Botones Registrar pago / Entregar abren sus hojas; desaparecen/cambian si ya está pagado o entregado |
| Detalle de presupuesto | /presupuestos/:id | MobPresupuestoDetalle | Selector de estado (Borrador/Enviado/Aceptado/Rechazado); líneas con precio lista tachado/mayorista; seña sugerida; botones Exportar PDF y Aceptar y crear pedido |
| Ficha de cliente | /clientes/:id | MobClienteFicha | Botón "Editar" en barra; avatar + etiqueta; tarjetas Comprado/Saldo; datos (email, teléfono, CUIT, mínimo mayorista); lista de pedidos/presupuestos con enlace; botones Presupuesto / Nuevo pedido |
| Detalle de producto | /productos/:id | MobProductoDetalle | Carrusel de fotos; precio/costo/margen vs objetivo; stock (disponible/reservado/por producir); composición del costo; botones Vender / Agregar a pedido; "Editar" en barra |

## Familia C · Formulario a pantalla completa con secciones

Encabezado con título + pie fijo (Cancelar/Guardar o CTA). Representativa:
**Nuevo pedido** (la más completa: pasos, buscador de productos, resumen).

Se chequea una vez (en NuevoPedido): encabezado, secciones numeradas, inputs
(alto, foco, error inline, teclado numérico), selects (`▾`), segmentados,
steppers −/+, cálculo del resumen en vivo, pie fijo con CTA y total, validaciones,
cierre con cambios sin guardar.

| Pantalla | Ruta / cómo se abre | Artboard | Solo chequear |
|---|---|---|---|
| Nuevo pedido (rep.) | /pedidos → Nuevo | MobNuevoPedido | Borrador guardado; precio mayorista; composición del costo; seña con medio y cuenta; aviso de compra mínima |
| Nuevo presupuesto | /presupuestos → Nuevo | MobNuevoPresupuesto | Cliente opcional; fechas; líneas "Del catálogo" / "A medida"; cotización plegable; botones Guardar borrador y Crear y enviar |
| Nuevo cliente | /clientes → Nuevo | MobNuevoCliente | Selector Particular/Empresa/Revendedor; validación de email/teléfono; bloque precio mayorista solo si Revendedor; Cancelar/Crear |
| Producto (alta/edición) | /productos → Nuevo/Editar | MobProductoForm | Tipo (FDM/Resina/Estampado/Combo); secciones colapsables (Datos, Producción, Fotos, Precio); Calculado vs Precio fijo; aviso de precio desactualizado |
| Insumo (alta/edición) | /insumos → Nuevo/Editar | MobInsumoForm | Categoría cambia los campos (kg/L/u.); selects Tipo/Marca/Color; "precio desde Ajustes" |
| Nuevo evento | /calendario → Evento | MobNuevoEvento | Toggle Evento/Recordatorio; "Todo el día" (role switch); Desde/Hasta; Repetir y Avisarme; Vincular a pedido/cliente |
| Venta de mostrador | /ventas/nueva y /ventas/:id/editar | MobNuevaVenta | Carrito con steppers y "quedan N"; medio de pago; cuenta destino; descuento Sin/%/$; fecha; total en el CTA "Cobrar" |

## Familia D · Hoja inferior de acción

Hoja desde abajo sobre fondo oscurecido, manija, contenido corto, pie fijo con
CTA. Representativa: **Registrar pago**.

Se chequea una vez (en RegistrarPago): apertura/cierre, manija, scroll interno,
pie fijo con CTA con monto, chips de opción única, select "Entra a", cálculos en
vivo, menú inferior oculto mientras está abierta, foco y teclado.

| Pantalla | Se abre desde | Artboard | Solo chequear |
|---|---|---|---|
| Registrar pago (rep.) | /pedidos/:id → Registrar pago | MobRegistrarPago | Atajos Todo el saldo / 50 % / Otro; comisión y neto; "Es una seña" |
| Entregar pedido | /pedidos/:id → Entregar | MobEntregar | Steppers por producto con tope "Listo X de Y"; ítem sin listo deshabilitado; aviso de saldo; botón "Cobrar antes de entregar" abre Registrar pago; CTA con cantidad |
| Filtros de pedidos | /pedidos → Filtros | MobFiltros | Chips multi-selección por grupo; "Limpiar"; CTA "Ver N pedidos" con conteo en vivo; contador en el botón de la lista |
| Movimiento de billetera | /billetera → Registro / Transferir / Pagar | MobTransferir | Selector Ingreso/Egreso/Compra/Transferir cambia campos; Desde/Hacia con saldo; nota explicativa; CTA "Transferir $" |

## Familia E · Panel con KPIs y secciones

Barra + selector de período + tarjetas de totales + secciones de resumen + menú
inferior. Representativa: **Dashboard**.

Se chequea una vez (en Dashboard): saludo/barra, selector Mes/Trimestre/Año,
grilla de KPIs 2×2, tarjetas de alertas con enlace, gráfico (legible a 390 px),
barras por canal, estados vacíos.

| Pantalla | Ruta | Artboard | Solo chequear |
|---|---|---|---|
| Dashboard (rep.) | /dashboard | MobDashboard | Alertas "Para hoy"; Producción; gráfico 6 meses; Ventas por canal; link a ranking |
| Ventas | /ventas | MobVentas | Selector de mes con flechas; KPIs Vendido/Ganancia; "Por área" con mostrador/pedidos; lista de operaciones, mostrador editable; botón PDF; acción a venta de mostrador |
| Billetera | /billetera | MobBilletera | Disponible total; selector de cuentas (carrusel); 3 botones Registro/Transferir/Pagar; movimientos agrupados por día con +/−/⇄; comisión, anulado (tachado) |

## Familia F · Índice en filas

Lista de filas con ícono, título, subtítulo y chevron, agrupadas por título de
sección. Representativa: **Ajustes**.

| Pantalla | Ruta | Artboard | Solo chequear |
|---|---|---|---|
| Ajustes (rep.) | /ajustes | MobAjustes | Agrupación (Costos y precios / Catálogos / Equipo); subtítulos con datos reales (8 tipos, 50 colores, 3 usuarios); "Zona de cuidado" y reset solo admin pidiendo código; cada fila navega a su subpantalla y vuelve |
| Más | /mas | MobMas | Cabecera de usuario; subtítulos dinámicos (2 enviados, 6 bajo margen, 3 stock bajo); toggle "Sincronizar en tiempo real" (role switch); Cerrar sesión; menú inferior visible con "Más" activo |

## Familia G1 · Subpantalla de ajustes con formulario

Barra con volver + secciones de campos + botón Guardar al pie. Representativa:
**Valores generales**.

| Pantalla | Ruta | Artboard | Solo chequear |
|---|---|---|---|
| Valores generales (rep.) | /ajustes/valores-generales | MobAjustesGeneral | Inputs con prefijo $ / unidades; equipos (editar/quitar/agregar); "Guardar y recalcular precios" |
| Ganancias | /ajustes/ganancias | MobAjustesGanancias | Margen por área; interruptor "Activo" del descuento; áreas a las que se aplica; simulador (lista, −20 %, mayorista, te queda) cambia en vivo; aviso de pérdida si margen < 25 % |

## Familia G2 · Subpantalla de ajustes con catálogo en lista

Barra + texto de ayuda + filas/tarjetas por ítem + edición en hoja o en línea.
Representativa: **Filamento**.

| Pantalla | Ruta | Artboard | Solo chequear |
|---|---|---|---|
| Filamento (rep.) | /ajustes/filamento | MobAjustesMateriales | Pestañas Precios/Tipos/Marcas; promedio por tipo; precio por marca con fecha; editar y agregar |
| Resina | /ajustes/resina | (usa MobAjustesMateriales) | Mismo layout con precios por litro y textos de resina |
| Impresos | /ajustes/impresos | MobAjustesImpresos | Agrupado por tipo (DTF/Sublimación/Vinilo); costo por cm² calculado; alta/edición |
| Colores | /ajustes/colores | MobAjustesColores | Muestra de color, hex, "N insumos"; borrar bloqueado si lo usa un insumo; editar/agregar |
| Usuarios | /ajustes/usuarios | MobAjustesUsuarios | Pestañas Usuarios/Roles/Áreas (rutas hijas); avatar iniciales; pills Admin/Activa/Inactivo; hoja de edición (switch "Puede entrar", rol, áreas); Guardar cambios |

Nota: Resina no tiene artboard propio; se verifica contra el de Filamento.

## Pantallas únicas

| Pantalla | Ruta | Artboard | Lista de chequeo propia |
|---|---|---|---|
| Login | /login | MobLogin | Logo y título; "Continuar con Google"; separador "o con email"; email/contraseña; Ingresar; mensaje de acceso denegado; sin barra ni menú inferior; teclado no tapa el botón |
| Calendario | /calendario | MobCalendario | Barra con "Hoy" y flechas de semana; tira de días con selección y puntos; tabs Agenda/Semana/Mes; agenda por día (atrasadas, eventos con hora, entregas, "Sin entregas ni eventos"); botón "Evento" en el menú inferior abre Nuevo evento; cambio de semana y mes |

## Orden de QA propuesto

1. Piezas compartidas (sección 0) junto con la ronda de Familia A.
2. A · Pedidos (rep.) y luego solo diferencias de Presupuestos, Clientes, Productos, Insumos, Cola.
3. B · PedidoDetalle (rep.) y diferencias de los otros tres.
4. D · RegistrarPago (rep.) y diferencias (se prueba abriéndolas desde B).
5. C · NuevoPedido (rep.) y diferencias de los otros seis.
6. E · Dashboard, Ventas, Billetera.
7. F · Ajustes y Más.
8. G1 y G2 · una pantalla representativa cada una, luego diferencias.
9. Únicas: Login (sin sesión), Calendario.

## Estimación

- Rondas del QA visual (una por pantalla representativa o única): 8 reps + 2 únicas = **10** (en vez de 34).
- Las 24 pantallas restantes se revisan en la misma sesión que su representativa, con una pasada corta de 3–5 puntos cada una.
- Las pruebas funcionales siguen el mismo agrupamiento: flujos completos en la representativa y solo los casos específicos en el resto.
- Ahorro estimado: ~65 % de las rondas, con la parte más costosa (piezas compartidas) hecha una sola vez.

---

# Parte 2 · Desarrollo: qué extraer por familia

Conteos hechos con grep en `frontend/src/app` (aprox.; las líneas a eliminar son
estimaciones). Ya existe en `_mobile-kit.scss` (427 líneas): `m-ib`, `m-card`,
`m-row`, `m-pill`, `m-chips/m-chip`, `m-search`, `m-fbtn`, `m-tools`, `m-kpis`,
`m-sw`, `m-body`, `m-sheet*`. Uso hoy: `m-card` en 32 archivos, `m-row` en 22,
`m-sec-t` en 19, `m-body` en 21, `m-ib` en 27, `db-mobile-bar` en 25, `m-pill` en
16, `m-chip` en 10, `m-search`/`m-tools` en 10, `m-fbtn` en 3. Lo que NO está
compartido (se copia por página con prefijo propio) es lo que conviene extraer.

## Hallazgo transversal: barra fija ("dock") — extraída

Componente compartido: `components/mobile-dock` (`db-mobile-dock`) + clase
`m-has-dock` en `_mobile-kit.scss`. Usado en detalles (B), formularios order/sale
(C) y subpantallas de ajustes con Guardar (G).

## Por familia

### A · Listas (Pedidos, Presupuestos, Clientes, Productos, Insumos, Cola)

a) **Extraer**
- `db-mobile-list-toolbar` (`components/mobile-list-toolbar`): inputs `search` (model),
  `placeholder`, `filterCount`, `chips` (`{id,label,count}[]`), `chip` (model),
  output `filterClick`; slot para botón extra (ej. "Tipo y categoría"). Hoy el bloque
  `m-tools` + `m-search` + `m-fbtn` + `m-chips` se repite en 6 `*.component.html`
  (orders, quotes, customers, products, supplies, print-jobs; 3 matches c/u).
- `MobileListStateService<T>` genérico (`core/services`): `save/read` con `scrollY`.
  Hoy 4 servicios (orders 47, products 38, customers 31, quotes 26 = 142 líneas) y la
  lógica de restaurar/guardar scroll en 4 componentes.
- `db-mobile-card-link` (tarjeta clickable con avatar/iniciales, título, subtítulo, pill, monto):
  hoy cada lista reescribe su tarjeta con `m-card`/`m-row`/`m-pill` (86 usos de `m-card`).
- `db-mobile-banner` (aviso con ícono + acción): Insumos (stock bajo), Productos (precios
  desactualizados), Ajustes G1 (pérdida), Presupuesto/Nuevo (nota).

b) **Si cambiás X, tocá**
- Buscador, chips o botón de filtros: el nuevo `mobile-list-toolbar` + `_mobile-kit.scss`
  (`m-search`, `m-chip`, `m-fbtn`, `m-tools`) y hoy los 6 `pages/{orders,quotes,customers,products,supplies,print-jobs}/*.component.html`.
- Estado al volver: `*-mobile-state.service.ts` y el `*.component.ts` de cada lista.
- Pill/color de estado: `_mobile-kit.scss` (`m-pill*`) y helpers de `shared/utils`.
- Menú inferior / barra: `components/mobile-bar`, `layout/layout.component.ts`.

### B · Detalles con barra fija (Pedido, Presupuesto, Cliente, Producto)

a) **Extraer**
- ~~`db-mobile-dock`~~ → ya en `components/mobile-dock` (+ `m-has-dock`).
- `db-mobile-contact-card` (cliente con avatar + WhatsApp/Llamar): repetido en
  order-detail, quote-detail y customer-detail.
- `db-mobile-totals` (Total/Pagado/Saldo o Subtotal/Descuento/Total): order-detail,
  quote-detail, order-form resumen, sale-form.
- `db-mobile-collapsible` (sección con título, contador y chevron): Tareas/Entregas/Historial.
- Mismo `m-sheet` para menús de acciones: `pushOverlay` está copiado en 7 archivos; extraer
  `db-mobile-action-sheet` que lo llame solo.

b) **Si cambiás X, tocá**
- Botones fijos o su altura: `components/mobile-dock` (+ clase `m-has-dock` en `_mobile-kit.scss`).
- Ruta con dock sin menú inferior: `layout/layout.component.ts` (`shouldHideBottomNav`).
- Tarjeta de cliente/contacto: `mobile-contact-card` (hoy order-detail, quote-detail, customer-detail).
- Totales: `mobile-totals` + `shared/utils` (saldos).

### C · Formularios a pantalla completa (Nuevo pedido, presupuesto, cliente, producto, insumo, evento, venta)

a) **Extraer**
- `db-mobile-form-shell` (`components/mobile-form-shell`): inputs `title`, `subtitle`,
  `submitLabel`, `submitDisabled`, `loading`; slots cuerpo y pie; usa `db-mobile-dock`.
  Hoy cada form arma encabezado + pie por su cuenta (`wallet-form__footer`,
  `form-footer` de customer, supply, category, impreso; order/sale ya usan `db-mobile-dock`).
- `db-mobile-step` (sección numerada "1 · Cliente"): order-form, quote-form, sale-form.
- `db-mobile-segmented` y `db-mobile-stepper` (−/+): repetidos en order-form (productos),
  quote-form (líneas), sale-form (carrito), order-delivery sheet.
- `db-mobile-select-field` (label + `▾` + hoja de opciones): cliente, canal, cuenta, categoría, color, marca.
- Estilos de campo (`m-lbl`, `m-hint`, error inline): unificar en `_mobile-kit.scss`.

b) **Si cambiás X, tocá**
- Encabezado/pie del form: `mobile-form-shell` (hoy `order-form`, `sale-form`, `customer-form`, `supply-form`, `product-form`, `quote-form`, `event` y `modals`); el pie fijo ya usa `components/mobile-dock` en order-form y sale-form.
- Apertura a pantalla completa: `modals` (`form-dialog-panel--order-fullscreen`) y `shared/styles/_modal.scss`.
- Stepper o segmentado: componentes nuevos + order-form-products, quote lines, sale-form-cart.

### D · Hojas inferiores (Registrar pago, Entregar, Filtros, Movimiento de billetera)

a) **Extraer**
- `db-mobile-sheet` (`components/mobile-sheet`): inputs `title`, `open`, `primaryLabel`,
  `primaryDisabled`; outputs `closed`, `primary`; llama `pushOverlay/popOverlay` solo
  (también en `ngOnDestroy`). Hoy `m-sheet*` existe solo como CSS y cada hoja arma
  markup y overlay a mano: `order-filters-sheet`, `product-filters-sheet`,
  `od-pay-sheet`, `od-del-sheet`, wallet-movements, wallet-record/transfer/repayment/void
  (`wallet-form__footer`).
- `db-mobile-chip-group` (selección única o múltiple, con contador): Filtros, medio de pago,
  Registrar pago (50 %, todo el saldo), tipo de movimiento.
- `db-mobile-summary-row` (etiqueta + valor): neto, comisión, saldo.

b) **Si cambiás X, tocá**
- Look de la hoja (manija, radio, pie): `mobile-sheet` + `_mobile-kit.scss` (`m-sheet*`) + `shared/styles/_modal.scss`.
- Overlay y menú inferior: `layout/layout-ui.service.ts` (`pushOverlay/popOverlay`).
- Cada hoja: `modals/*-filters-sheet*`, `order-detail-payments`, `order-detail-deliveries`, `wallet/components/*-form`.

### E · Paneles (Dashboard, Ventas, Billetera)

a) **Extraer**
- `db-mobile-kpi-grid` (inputs `items: {label,value,hint,tone}[]`, `cols`): hoy `m-kpis/m-kpi`
  (19 líneas en 5 archivos) más variantes locales de dashboard y ventas.
- `db-mobile-period-picker` (Mes/Trimestre/Año o mes con flechas): Dashboard, Ventas, Calendario.
- `db-mobile-alert-card` (ícono, texto, link): Dashboard "Para hoy" y banners de A.
- `db-mobile-movement-row` (+/−/⇄, monto, comisión, anulado): Billetera y operaciones de Ventas.

b) **Si cambiás X, tocá**
- KPIs: `mobile-kpi-grid` y `_mobile-kit.scss`; datos en `pages/dashboard`, `pages/sales`, `pages/wallet`.
- Selector de período: `mobile-period-picker` + los tres componentes de página.
- Movimientos: `pages/wallet/components/wallet-movements` y `pages/sales`.

### F · Índices (Ajustes, Más)

a) **Extraer**
- `db-mobile-nav-list` (grupos `{title, items:{icon,label,hint,link}[]}`): `settings-home` y
  `pages/more` hacen lo mismo con `m-row`; `st-m` tiene su propio estilo.
- `db-mobile-toggle-row` (con `role="switch"`, `m-sw` ya existe): Más (sincronizar), Ganancias, Usuarios.

b) **Si cambiás X, tocá**: `mobile-nav-list`; `pages/settings/settings-home`, `pages/more`; ítems de menú en sus `.ts`.

### G1 / G2 · Subpantallas de ajustes

a) **Extraer**
- `db-mobile-settings-page` (barra con volver + cuerpo + dock opcional): hoy cada página de
  ajustes repite `st-m` + barra; el dock ya es `db-mobile-dock` en general-values,
  profit-settings e impresos-settings. Resto (filament, resin, colors, users) en
  `_settings-mobile.scss` + `settings-users-mobile-shell`.
- `db-mobile-field-group` (label + input con prefijo `$`/sufijo unidad): general-values, profit-settings.
- `db-mobile-catalog-row` (swatch/ícono, título, subtítulo, valor, acciones): filamento, resina, impresos, colores, usuarios.
- Filamento y resina ya comparten `material-price-settings.scss`; sumarlos al mismo componente de fila.

b) **Si cambiás X, tocá**: pie fijo → `components/mobile-dock` (+ `m-has-dock`); resto en
`pages/settings/_settings-mobile.scss`, `material-price-settings.scss`,
`settings-users-mobile-shell.*`, y el HTML de la página específica.

## Orden recomendado de extracción (mayor a menor ahorro)

| # | Extracción | Familias | Dónde se repite hoy | Líneas a eliminar (est.) | Riesgo |
|---|---|---|---|---|---|
| 1 | ~~`db-mobile-dock`~~ (hecho) | B, C, G | `components/mobile-dock` | — | Hecho |
| 2 | `db-mobile-sheet` + `chip-group` | D (también B) | ~10 hojas, `pushOverlay` en 7 archivos | ~250 | Medio (foco, teclado, overlay) |
| 3 | `db-mobile-list-toolbar` + `MobileListStateService<T>` | A | 6 listas, 4 servicios | ~70 HTML + ~100 estado + ~80 TS = **~250** | Medio (persistencia de filtros) |
| 4 | `db-mobile-form-shell` + `step` + `stepper` + `segmented` + `select-field` | C | 7 formularios | ~220 | Alto (formularios grandes, validaciones) |
| 5 | `db-mobile-settings-page` + `catalog-row` + `field-group` | G1/G2 | 8 páginas + shell | ~150 | Bajo |
| 6 | `db-mobile-contact-card` + `totals` + `collapsible` | B | 3–4 detalles | ~130 | Bajo |
| 7 | `db-mobile-kpi-grid` + `period-picker` + `movement-row` | E | 3 paneles | ~100 | Bajo |
| 8 | `db-mobile-nav-list` + `toggle-row` | F | 2 pantallas | ~60 | Bajo |
| 9 | `db-mobile-card-link` + `banner` | A | 6 listas, 4 banners | ~90 | Bajo |

Total estimado: **~1.500 líneas** (de ~7.700 de SCSS de páginas más sus templates). Reglas:
extraer **después** del QA mobile si se quiere no mover pantallas ya aprobadas, o por
familia con QA de la representativa tras cada extracción; los pasos 1 y 2 conviene hacerlos
primero porque tocan más pantallas con el mismo riesgo. Desktop no se toca en ninguna
extracción (todo queda dentro de `mobile-only`).
