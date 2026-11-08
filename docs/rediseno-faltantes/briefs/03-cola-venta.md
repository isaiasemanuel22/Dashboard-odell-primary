Leé primero docs/rediseno-faltantes/reglas-implementacion.md y seguilo. Nunca hagas git commit/add/stash.

Grupo 3 · Cola de trabajo (desktop) y Venta de mostrador (desktop).

A. Cola: pages/print-jobs (bloque desktop-only), print-jobs-toolbar y components/print-job-card (variante board). Artboard RdCola.dc.html.
- Encabezado como el resto de las páginas (h1, subtítulo con conteos y bloqueadas en rojo; buscador con ícono SVG y «+ Nueva tarea»).
- Barra de filtros: Área con chips del sistema y Cliente con avatares (filtro existente). Si el grupo 1 dejó el panel de filtros compartido, no lo agregues acá salvo que ya se use.
- Tablero de columnas con fondo suave, título con punto de color por estado (✓ SVG en Terminado), contador, zona punteada «Por agregar al tablero» con botón «+ Agregar al tablero».
- Tarjeta: #pedido (link), prioridad como pastilla (Alta rojo, Media ámbar, Normal/Baja neutro), título, etiqueta de área, fecha de entrega (atrasado en rojo si el helper lo da), motivo de bloqueo en caja roja suave, avatar del cliente. Terminadas con opacidad reducida.
- Sin emoji, sin hex sueltos. Drag & drop (cdk) y todas las acciones igual que hoy. Mobile no se toca.

B. Venta de mostrador desktop: modals/sale-form-dialog + pages/sales/sale-form (+ sale-form-cart). Artboard RdVentaMostrador.dc.html: modal 960 con dos columnas (buscador + carrito con stepper, subtotal por línea y quitar | cobro: medio de pago segmentado, entra a, descuento, fecha, nota, totales) y pie con «Cobrar $ N». Mismos campos y lógica; la ruta /ventas/nueva y la versión mobile no cambian su comportamiento (si sale-form se usa también en mobile, el layout de 2 columnas va solo en desktop).
