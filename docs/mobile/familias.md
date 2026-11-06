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
| Formulario a pantalla completa | NuevoPedido | Encabezado con cerrar (confirmación de descarte unificada si hay cambios), secciones numeradas, pie fijo con «Falta: …» en el dock, sin menú inferior |
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
| Impresos | /ajustes/impresos | MobAjustesImpresos | Pliegos de referencia (tamaño/costo) + lista de impresos; costo por cm²; alta/edición |
| Colores | /ajustes/colores | MobAjustesColores | Muestra de color, hex, "N insumos"; borrar bloqueado si lo usa un insumo; editar/agregar |
| Usuarios | /ajustes/usuarios | MobAjustesUsuarios | Pestañas Usuarios/Roles/Áreas (rutas hijas); avatar iniciales; pills Admin/Activa/Inactivo; hoja de edición (switch "Puede entrar", rol, áreas); Guardar cambios |

Nota: Resina no tiene artboard propio; se verifica contra el de Filamento.

## Pantallas únicas

| Pantalla | Ruta | Artboard | Lista de chequeo propia |
|---|---|---|---|
| Login | /login | MobLogin | Logo y título; "Continuar con Google"; separador "o con email"; email/contraseña; Ingresar; mensaje de acceso denegado; sin barra ni menú inferior; teclado no tapa el botón |
| Calendario | /calendario | MobCalendario | En mobile (390 px): tabs **Agenda** y **Mes** (Semana no entra a ese ancho; la tira de días / flechas cubren el salto semanal). Agenda por día (atrasadas, eventos con hora, entregas, "Sin entregas ni eventos"); botón "Evento" abre Nuevo evento; cambio de mes |

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

a) **Extraer** — hecho (extracción 3 + 9)
- ~~`db-mobile-list-toolbar`~~ → `components/mobile-list-toolbar` (`db-mobile-list-toolbar`).
- ~~`MobileListStateService`~~ → `core/services/mobile-list-state.service.ts` +
  `injectMobileListPersistence` (Pedidos, Presupuestos, Clientes, Productos, Insumos, Cola).
- ~~`db-mobile-card-link`~~ → `components/mobile-card-link` (Clientes; pedidos/productos/presupuestos
  siguen con tarjeta propia; insumos conserva fila con barra de stock).
- ~~`db-mobile-banner`~~ → `components/mobile-banner` (Productos e Insumos; G1/forms pendientes).

b) **Si cambiás X, tocá**
- Buscador, chips o botón de filtros: `components/mobile-list-toolbar` + `_mobile-kit.scss`
  (`m-search`, `m-chip`, `m-fbtn`, `m-tools`); consumidores en
  `pages/{orders,quotes,customers,products,supplies,print-jobs}`.
- Estado al volver: `core/services/mobile-list-state.service.ts` y el `*.component.ts` de cada lista.
- Tarjeta fila (avatar/monto/chevron): `components/mobile-card-link`.
- Banner de aviso: `components/mobile-banner`.
- Pill/color de estado: `_mobile-kit.scss` (`m-pill*`) y helpers de `shared/utils`.
- Menú inferior / barra: `components/mobile-bar`, `layout/layout.component.ts`.

### B · Detalles con barra fija (Pedido, Presupuesto, Cliente, Producto)

a) **Extraer** — hecho (extracción 6)
- ~~`db-mobile-dock`~~ → ya en `components/mobile-dock` (+ `m-has-dock`).
- ~~Menús ⋯ / hojas de acción~~ → `db-mobile-sheet` (`components/mobile-sheet`) +
  `m-sheet-action` en `_mobile-kit.scss` (pedido, presupuesto, cliente, producto,
  productos, billetera).
- ~~`db-mobile-contact-card`~~ → `components/mobile-contact-card` (customer-detail;
  order-detail solo acciones con `showIdentity=false`).
- ~~`db-mobile-totals`~~ → `components/mobile-totals` (order-detail cols + quote-detail rows).
- ~~`db-mobile-collapsible`~~ → `components/mobile-collapsible` (Pagos/Tareas/Entregas/Historial
  en order-detail).

b) **Si cambiás X, tocá**
- Botones fijos o su altura: `components/mobile-dock` (+ clase `m-has-dock` en `_mobile-kit.scss`).
- Ruta con dock sin menú inferior: `layout/layout.component.ts` (`shouldHideBottomNav`).
- Menú ⋯ / hoja de acciones: `components/mobile-sheet` (+ `m-sheet*` / `m-sheet-action`
  en `_mobile-kit.scss`) y el HTML del detalle o lista que la abre.
- Tarjeta de contacto: `components/mobile-contact-card` (customer-detail, order-detail).
- Totales: `components/mobile-totals` + `shared/utils` (saldos); consumidores en
  `pages/orders/order-detail`, `pages/quotes/quote-detail`.
- Secciones plegables: `components/mobile-collapsible` + `order-detail`.

### C · Formularios a pantalla completa (Nuevo pedido, presupuesto, cliente, producto, insumo, evento, venta)

a) **Extraer** — hecho (extracción 4; `select-field` saltado)
- ~~`db-mobile-form-shell`~~ → ya en `components/mobile-form-shell` (barra X/título/acción,
  cuerpo, pie opcional con `db-mobile-dock`). Migrado en order/quote/customer/product/supply
  dialogs y sale-form; evento usa `db-mobile-dock` en el pie mobile.
- ~~`db-mobile-form-step`~~ → ya en `components/mobile-form-step` (order-form, quote-form,
  sale-form).
- ~~`db-mobile-stepper`~~ → ya en `components/mobile-stepper` (order-form-line, sale-form,
  order-detail-deliveries). Segmentado mobile: variante en `db-segmented-control` (size lg),
  no chip-group.
- `db-mobile-select-field`: **saltado** — no hay patrón repetido de label+▾+hoja; se usan
  `db-select` / `db-autocomplete`.
- Estilos de campo (`m-fl`, `m-field`, `m-field-error`, labels/inputs 48px): en `_mobile-kit.scss`.

b) **Si cambiás X, tocá**
- Encabezado/pie del form: `components/mobile-form-shell` (+ `components/mobile-dock`);
  dialogs `order-form-dialog`, `quote-form-dialog`, `customer-form-dialog`,
  `product-form-dialog`, `supply-form-dialog`, `calendar-event-dialog`;
  `pages/sales/sale-form`. Forms con `hideFooter` en mobile: customer/supply/product.
- Apertura a pantalla completa: `modals` (`form-dialog-panel--order-fullscreen`) y `shared/styles/_modal.scss`.
- Stepper: `components/mobile-stepper` + `order-form/linea`, `sale-form`, `order-detail-deliveries`.
- Secciones numeradas: `components/mobile-form-step` + `order-form`, `sale-form`.
- Segmentado mobile: `components/db-segmented-control` (estilos lg en mobile).

### D · Hojas inferiores (Registrar pago, Entregar, Filtros, Movimiento de billetera)

a) **Extraer**
- ~~`db-mobile-sheet`~~ → ya en `components/mobile-sheet` (+ `m-sheet*` / `m-sheet-action`).
  Overlay (`pushOverlay`/`popOverlay`) solo ahí (y pantallas fullscreen / form-modal
  que aún no migraron: paneles de productos, `claimFormOverlay` de billetera).
- ~~`db-mobile-chip-group`~~ → ya en `components/mobile-chip-group` (filtros de pedidos
  y productos, medio de pago en hoja de pago).
- `db-mobile-summary-row` (etiqueta + valor): neto, comisión, saldo.
- Atajos de monto / tipo de movimiento aún locales donde aplique.

b) **Si cambiás X, tocá**
- Look de la hoja (manija, radio, pie): `components/mobile-sheet` + `_mobile-kit.scss`
  (`m-sheet*`) + `shared/styles/_modal.scss` (FormDialogService).
- Chips de opción en hojas: `components/mobile-chip-group`.
- Overlay y menú inferior: `layout/layout-ui.service.ts` vía `mobile-sheet` (excepciones:
  `products` paneles fullscreen, `wallet` form-modal).
- Cada hoja: `modals/*-filters-sheet*`, `order-detail-payments`, `order-detail-deliveries`,
  `wallet/components/*-form`, detalles con menú ⋯.

### E · Paneles (Dashboard, Ventas, Billetera)

a) **Extraer** — hecho parcial (extracción 7)
- ~~`db-mobile-kpi-grid`~~ → `components/mobile-kpi-grid` (Dashboard, Ventas, customer-detail).
- ~~`db-mobile-period-picker`~~ → `components/mobile-period-picker` (Dashboard segmentos,
  Ventas mes con flechas). Calendario **no** migrado (navegación de semana distinta).
- `db-mobile-alert-card`: pendiente (sigue markup local / `db-mobile-banner` en A).
- ~~`db-mobile-movement-row`~~ → `components/mobile-movement-row` (wallet-movements).

b) **Si cambiás X, tocá**
- KPIs: `components/mobile-kpi-grid` + `_mobile-kit.scss` (`m-kpis`); datos en
  `pages/dashboard`, `pages/sales`, `pages/customers/customer-detail`.
- Selector de período: `components/mobile-period-picker` + `pages/dashboard`, `pages/sales`.
- Movimientos: `components/mobile-movement-row` + `pages/wallet/components/wallet-movements`.

### F · Índices (Ajustes, Más)

a) **Extraer** — hecho (extracción 8)
- ~~`db-mobile-nav-list`~~ → `components/mobile-nav-list` (`settings-home`). Más sigue con
  tiles propios (no es el mismo patrón de filas).
- ~~`db-mobile-toggle-row`~~ → `components/mobile-toggle-row` (Más sincronizar; Ganancias
  Activo con `variant="line"`).

b) **Si cambiás X, tocá**: `components/mobile-nav-list` + `pages/settings/settings-home`;
`components/mobile-toggle-row` + `pages/more`, `pages/settings/profit-settings`.

### G1 / G2 · Subpantallas de ajustes

a) **Extraer** — hecho (extracción 5)
- ~~`db-mobile-settings-page`~~ → `components/mobile-settings-page` (barra + slots
  `[barAction]`/`[tabs]`/`[tools]` + cuerpo + dock opcional). Consumido por
  general-values, profit, filament, resin, impresos, colors y `settings-users-mobile-shell`.
- ~~`db-mobile-field-group`~~ → `components/mobile-field-group` (general-values, filament,
  resin, colors; prefijo `$` / sufijo `%`).
- ~~`db-mobile-catalog-row`~~ → `components/mobile-catalog-row` (filament, resin, impresos,
  usuarios; colores conserva grilla `st-m__sw`).

b) **Si cambiás X, tocá**: shell → `components/mobile-settings-page`; filas →
`components/mobile-catalog-row`; campos → `components/mobile-field-group`; tabs/hints
locales aún en `pages/settings/_settings-mobile.scss` y `material-price-settings.scss`.

## Orden recomendado de extracción (mayor a menor ahorro)

| # | Extracción | Familias | Dónde se repite hoy | Líneas a eliminar (est.) | Riesgo |
|---|---|---|---|---|---|
| 1 | ~~`db-mobile-dock`~~ (hecho) | B, C, G | `components/mobile-dock` | — | Hecho |
| 2 | ~~`db-mobile-sheet` + `chip-group`~~ (hecho) | D (también B) | `components/mobile-sheet`, `mobile-chip-group` | — | Hecho |
| 3 | ~~`db-mobile-list-toolbar` + `MobileListStateService`~~ (hecho) | A | `mobile-list-toolbar`, `mobile-list-state.service` | — | Hecho |
| 4 | ~~`db-mobile-form-shell` + `step` + `stepper` + segmented~~ (hecho; `select-field` saltado) | C | `mobile-form-shell`, `mobile-form-step`, `mobile-stepper` | — | Hecho (pies customer/supply/product/event migrados; select-field sin repetición real) |
| 5 | ~~`db-mobile-settings-page` + `catalog-row` + `field-group`~~ (hecho) | G1/G2 | `mobile-settings-page`, `mobile-catalog-row`, `mobile-field-group` | ~150 | Hecho |
| 6 | ~~`db-mobile-contact-card` + `totals` + `collapsible`~~ (hecho) | B | `mobile-contact-card`, `mobile-totals`, `mobile-collapsible` | ~130 | Hecho |
| 7 | ~~`db-mobile-kpi-grid` + `period-picker` + `movement-row`~~ (hecho; alert-card y calendario pendientes) | E | `mobile-kpi-grid`, `mobile-period-picker`, `mobile-movement-row` | ~100 | Hecho |
| 8 | ~~`db-mobile-nav-list` + `toggle-row`~~ (hecho) | F | `mobile-nav-list`, `mobile-toggle-row` | ~60 | Hecho |
| 9 | ~~`db-mobile-card-link` + `banner`~~ (hecho) | A | `mobile-card-link`, `mobile-banner` | — | Hecho |

Total estimado: **~1.500 líneas** (de ~7.700 de SCSS de páginas más sus templates). Reglas:
extraer **después** del QA mobile si se quiere no mover pantallas ya aprobadas, o por
familia con QA de la representativa tras cada extracción; los pasos 1 y 2 conviene hacerlos
primero porque tocan más pantallas con el mismo riesgo. Desktop no se toca en ninguna
extracción (todo queda dentro de `mobile-only`).
