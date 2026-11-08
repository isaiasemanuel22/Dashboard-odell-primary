Leé primero docs/rediseno-faltantes/reglas-implementacion.md y seguilo. Nunca hagas git commit/add/stash.

Grupo 4 · Detalle de pedido (desktop), selector de piezas y días de la semana.

A. pages/orders/order-detail (bloque desktop y subcomponentes de pagos, entregas, historial, descripción). Artboard RdPedidoDetalle.dc.html. Mismo contenido y acciones que hoy; ordená en tarjetas como el artboard, encabezado de página consistente, tabla de líneas con db-data-table si encaja, totales, y reemplazá los ~38 hex por tokens. Mobile no se toca.

B. components/product-piece-picker: sigue siendo combobox con desplegable en desktop (NO lo conviertas en modal). Estilizá el desplegable como la lista de RdSelectorPiezas.dc.html (miniatura, nombre, «categoría · costo · stock», insignia Publicado/Interno, pie «+ Crear pieza nueva» si esa acción existe hoy). En mobile, al tocar el campo se abre a pantalla completa como MobRdSelectorPiezas.dc.html (barra con cerrar, buscador, lista). Sacá los 11 hex.

C. modals/calendar-event-weekdays (dentro de Nuevo evento): chips L M M J V S D con aria-pressed y el texto de ayuda, como RdModalesChicos (tarjeta Días) y MobRdDiasSemana. Solo estilo con tokens; misma lógica.
