Leé primero docs/mobile/reglas-implementacion.md (corregí en los componentes/servicios compartidos cuando el problema esté ahí).

Correcciones de la prueba funcional mobile, parte 1. Cero cambios de reglas de negocio.

FALLOS
1. Scroll al volver del detalle no se conserva en Pedidos ni Productos (en Clientes sí). Investigá la diferencia (orden en que cada lista llama a la restauración vs cuándo termina de cargar/renderizar, chips que cambian la altura, `scrollActiveMobileChipIntoView` o un scrollTo(0) que pise la restauración, recarga de datos al volver). Dejá un único mecanismo en mobile-list-state.service que funcione en las 6 listas.
2. Las listas de Presupuestos y Clientes no dejan llegar al último ítem (el menú inferior lo tapa y el scroll se frena). Revisá el padding inferior del contenido / altura del contenedor con scroll en esas pantallas y unificá: todo contenido mobile con menú inferior debe tener padding-bottom = alto del menú + 24px (+ safe-area), en un solo lugar (m-body o el layout), y ningún contenedor intermedio con height/overflow que corte el scroll.
3. Al crear un pedido desde el botón central «+» (layout.openNewOrder) estando en /pedidos o volviendo a /pedidos, la lista no muestra el pedido nuevo hasta recargar. Hacé que las listas se refresquen cuando se crea/edita un registro desde un diálogo global: emití un evento en un servicio (ej. DataChangedService o el realtime existente) y que Pedidos (y Presupuestos/Clientes para sus «+») recarguen al recibirlo, también si ya estabas en la ruta.

PULIDO
4. Chips con contador: un solo criterio en db-mobile-list-toolbar — los contadores siempre se calculan sobre la lista ya filtrada por la búsqueda (y los filtros de hoja si aplica), y todos los chips de todas las listas muestran contador (Insumos FDM/Resina/Estampado, Presupuestos Rechazado/Cancelado), ocultando en 0 con el criterio ya acordado.
5. Detalle de pedido: la línea de fechas no debe cortarse con «…»: si no entra, que pase a 2 líneas alineada a la derecha («Creado 7/9» / «Vence 14/9»).
6. Detalle de producto: «Margen 100 % · objetivo 100 %» sin tocar el borde derecho (padding/ajuste de línea dentro de la tarjeta KPI).
7. Registrar pago: al elegir «Otro monto», vaciá el campo y poné el foco en él.
8. Editar pedido sin cambios: la X no debe preguntar por descartar. Revisá la detección de cambios (que Enter, el stepper o la inicialización no marquen el formulario como modificado); si el formulario no cambió respecto de los valores iniciales, cerrar sin preguntar.
9. Volver desde un detalle abierto desde otra pantalla (ej. Cola → Detalle de pedido → volver) debe volver a la pantalla de origen: en db-mobile-bar, si hay historial de navegación interna, el botón volver hace `location.back()`; el backLink queda como fallback cuando se entra directo.
10. Ficha de cliente: en la lista de pedidos mostrá a la derecha el saldo de cada pedido cuando tiene saldo («saldo $ X»), y el total en gris debajo; así coincide con el Saldo de arriba.
11. Hoja de movimiento de Billetera: que tenga también el botón «Cerrar» abajo como los menús de acciones (consistencia con db-mobile-sheet de acciones).
12. Insumos: en la lista, el precio que se muestra para un insumo y el de su hoja de edición no coinciden ($32.083/L vs «Elegoo — $35.920/L»). Investigá de dónde sale cada uno (promedio, última compra, marca seleccionada…) y mostrá el mismo dato con su aclaración en ambos lugares; no cambies cómo se calcula el costo.

Además actualizá docs/qa/pruebas-mobile.md: caso DP7 (Entregar ahora abre una hoja con aviso si no hay unidades listas) y la observación de que en la Cola «Agregar al tablero» pasa la tarea de backlog al tablero dentro de Por hacer (no cambia de pestaña).

Criterio: el de reglas-implementacion.md. Respondé con archivos tocados, la causa del punto 1 y del 12, y qué no se pudo.
