# Rediseño de pantallas y modales que faltaban (2026-11-07)

Lienzo: https://claude.ai/artifact/Xoad313w4HCRvMk24cFW5S · página «Rediseño · faltantes».

## Decisiones del usuario

- Alcance: todo lo de la lista de abajo, incluidos los modales chicos.
- Desktop y mobile: lo que hoy no tiene versión mobile también la recibe, con los patrones mobile ya aprobados.
- Cola de trabajo: rediseño solo visual, con las mismas funciones (el diseño v2 por impresora queda para su versión).
- Aprobación: primero patrones y 2–3 pantallas; con eso aprobado, un agente diseña el resto.
- No se tocan las pantallas que ya tienen artboard en «Versión actual» o «Mobile · rediseño».

## Muestras para aprobar

- `RdPatrones`: modal de formulario chico, confirmación (destructiva e informativa) y panel de filtros de desktop.
- `RdCola`: Cola de trabajo de desktop.
- `RdVentaMostrador`: modal de venta de mostrador de desktop.

## Pendientes de rediseño

| Pieza | Archivo | Desktop | Mobile |
|---|---|---|---|
| Cola de trabajo | pages/print-jobs (+ toolbar, print-job-card) | rediseñar | ya está |
| Detalle de pedido | pages/orders/order-detail | revisar contra V3PedidoDetalle / limpiar hex | ya está |
| Nuevo / editar pedido | pages/orders/order-form | revisar contra ModalPedido / limpiar hex | ya está |
| Nuevo presupuesto | modals/quote-form-dialog | llevar a ModalPresupuesto con db-* | ya está |
| Nuevo cliente | modals/customer-form-dialog | llevar a ModalCliente con db-* | ya está |
| Filtros ×6 (pedidos, presupuestos, ventas, productos, cola, calendario) | modals/*-filters-sheet | panel desplegable (RdPatrones §3) | ya está |
| Selector de piezas | components/product-piece-picker | rediseñar | nuevo |
| Venta de mostrador | modals/sale-form-dialog + sale-form | RdVentaMostrador | ya está (MobNuevaVenta) |
| Alta de categoría | modals/category-form-dialog | RdPatrones §1 | nuevo |
| Alta de impreso | modals/impreso-form-dialog | modal chico | nuevo |
| Pestañas Usuarios/Roles/Áreas | pages/settings/user-access/user-access-layout | rediseñar | ya está |
| Confirmación genérica | modals/confirm-dialog | RdPatrones §2 | nuevo (hoja) |
| Reemplazo de insumo | modals/supply-replacement-dialog | RdPatrones §2 | nuevo |
| Tarea independiente | modals/independent-task-dialog | modal chico (ver V2ModalTarea) | nuevo |
| Exportar presupuesto | modals/quote-document-export-dialog | modal medio | nuevo |
| Pago de cuenta | wallet/components/wallet-repayment-form | modal chico | nuevo |
| Anular movimiento | wallet/components/wallet-void-form | RdPatrones §2 | nuevo |
| Días de la semana (evento) | modals/calendar-event-weekdays | revisar | nuevo |
| Resetear base | modals/reset-database-dialog | RdPatrones §2 | — (solo admin, desktop) |
