Leé primero docs/mobile/reglas-implementacion.md (sección «No duplicar: modularizar»). No toques el markup ni el comportamiento de desktop. Nunca hagas git commit/add/stash.

Paridad mobile, tanda A: estas funciones existen en desktop y faltan en mobile. Para cada una, buscá cómo lo hace desktop y reutilizá el MISMO servicio/acción/helper (nada de lógica de negocio nueva ni duplicada); en mobile solo agregás la entrada de UI con los componentes db-mobile-* existentes (hoja de acciones «⋯» del detalle, db-mobile-sheet de filtros, chips, etc.). Cero cambios de reglas de negocio.

1. Pedidos — «Clonar pedido»: en la hoja de acciones del detalle de pedido mobile, igual que desktop.
2. Pedidos — aviso de cambio de precio en pedidos entregados: el mismo aviso que muestra desktop cuando corresponde, visible en el detalle mobile.
3. Presupuestos — «Duplicar presupuesto» en la hoja de acciones del detalle.
4. Presupuestos — volver de Enviado a Borrador: la misma acción/transición que desktop, en la hoja de acciones (solo cuando desktop la permite).
5. Presupuestos — filtro por área: agregarlo a la hoja de filtros mobile de Presupuestos (mismo criterio de filtrado que desktop, mismo helper).
6. Ventas — eliminar venta: en el detalle/hoja de acciones de una venta en mobile, con la misma confirmación y el mismo servicio (revierte stock como desktop).
7. Ventas — filtros: la misma información de filtros que desktop (fechas/medio de pago/lo que tenga) en una hoja de filtros mobile reutilizando el patrón de openOrderFilters/openProductFilters de FormDialogService.
8. Ventas — «Crear pedido desde una venta»: la misma acción que desktop, desde la hoja de acciones de la venta.
9. Clientes — filtro «Solo revendedores»: chip o filtro en la lista mobile de Clientes, mismo criterio que desktop.
10. Clientes — presupuestos en la ficha del cliente: sección (db-mobile-collapsible) con los presupuestos del cliente, igual dato que desktop, cada fila abre el detalle del presupuesto.

Si alguna no existe realmente en desktop, no la inventes: decilo en la respuesta.
Verificá `npm run build --prefix frontend` y `grep -rn "font: [0-9][^;]*inherit;" frontend/src` (no debe haber resultados).
Respondé con: archivos tocados, qué servicio/helper de desktop reutilizaste en cada punto y qué no se pudo.
