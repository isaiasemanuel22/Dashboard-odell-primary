Leé primero docs/rediseno-faltantes/reglas-implementacion.md y seguilo. Nunca hagas git commit/add/stash.

Grupo 3 · Venta de mostrador (desktop).

La Cola de trabajo NO va en este grupo: la rediseña otra sesión. No toques pages/print-jobs ni components/print-job-card.

B. Venta de mostrador desktop: modals/sale-form-dialog + pages/sales/sale-form (+ sale-form-cart). Artboard RdVentaMostrador.dc.html: modal 960 con dos columnas (buscador + carrito con stepper, subtotal por línea y quitar | cobro: medio de pago segmentado, entra a, descuento, fecha, nota, totales) y pie con «Cobrar $ N». Mismos campos y lógica; la ruta /ventas/nueva y la versión mobile no cambian su comportamiento (si sale-form se usa también en mobile, el layout de 2 columnas va solo en desktop).
