Leé primero docs/mobile/reglas-implementacion.md (en especial «No duplicar: modularizar»: corregí en los componentes compartidos cuando el problema esté ahí).

Correcciones de la QA visual, ronda 1 (piezas compartidas + listas). Desktop no cambia salvo en el punto 2.

1. ALTA · Scroll al volver del detalle (core/services/mobile-list-state.service.ts, `onListReady`/restauración): hoy restaura en un requestAnimationFrame cuando todavía se ven los esqueletos de carga y la página es más corta, así que el scroll queda limitado. Restaurá cuando la lista ya está renderizada con sus datos: reintentá en cada frame (máx. ~1,5 s) hasta que `document.documentElement.scrollHeight` permita llegar al valor guardado o se agote el tiempo; cancelá si el usuario scrollea antes. Vale para las 6 listas.
2. ALTA · Tipografía: `styles.scss` pide 'Inter' pero la fuente no se carga en ningún lado, así que se ve la del sistema. Cargá Inter (pesos 400, 500, 600, 700) con `<link rel="preconnect">` + Google Fonts css2 con `display=swap` en `frontend/src/index.html` (aplica a desktop también: es la fuente prevista). Que no rompa la carga inicial (es CSS externo, no JS).
3. ALTA · Cola (pages/print-jobs): las pestañas de estado son 6 y no entran en una fila (Cancelado baja sola y «En progreso» se parte). Convertilas en una fila con scroll horizontal (sin barra visible), cada pestaña con ancho mínimo para que el texto no se parta, la activa a la vista (scrollIntoView). Botones de las tarjetas siempre en el mismo orden en todas las pestañas: secundario «Detalle» a la izquierda y la acción principal a la derecha. Tareas bloqueadas: una sola acción principal con su texto propio (ej. la que use desktop para desbloquear/iniciar), no «Empezar».
4. MEDIA · Plurales: «Atrasado 1 día» / «N días» en la tarjeta de pedido (components/order-mobile-card) y en el resto donde se use (detalle). Usá el helper `pluralize` de shared/utils/order.helpers.ts.
5. MEDIA · Presupuestos: «Falta cliente para enviarlo» solo en presupuestos en Borrador (shared/utils/quote.helpers.ts, formatQuoteMobileContextHint).
6. MEDIA · Insumos: cantidad con unidad abreviada («0 u.», «200 ml», «1 kg» según la unidad del insumo; reusá la etiqueta de unidad que use desktop) y el mínimo también con unidad («mínimo 200 ml»). Orden: primero los de stock bajo o en 0, después el resto (mismo criterio de stock bajo que ya usa la app).
7. MEDIA · Hoja de Registrar pago: el botón principal con el primario mobile sólido #0E7AAB (no el degradado de desktop) y sin el espacio vacío de ~50px debajo del pie. Revisá si viene de db-mobile-sheet/db-mobile-dock y corregilo ahí para todas las hojas.
8. BAJA · Chips con contador 0: un solo criterio en todas las listas (en db-mobile-list-toolbar): ocultar los chips en 0 salvo «Todos»/«Abiertos» y el activo.
9. BAJA · Margen negativo con signo menos tipográfico «−28 %» (U+2212) en la tarjeta de producto mobile.
10. BAJA · Accesibilidad: las tarjetas-link de las listas (pedido, presupuesto, producto, card-link) necesitan nombre accesible (aria-label con «ord-X, cliente, estado, total» o equivalente).
11. BAJA · Píldoras de área en la Cola sin borde, como en el resto de las listas (usá la misma clase/estilo compartido que las tarjetas de pedido).

Criterio: el de reglas-implementacion.md. Respondé con archivos tocados y qué no se pudo resolver.
