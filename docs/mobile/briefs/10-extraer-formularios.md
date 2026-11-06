Leé primero docs/mobile/reglas-implementacion.md (en especial «No duplicar: modularizar») y docs/mobile/familias.md (parte 2, familia C y punto 4 del orden). Ya existen db-mobile-dock, db-mobile-sheet, db-mobile-chip-group, db-mobile-list-toolbar, db-mobile-card-link y db-mobile-banner: usalos.

Tarea: extracción 4 · formularios mobile a pantalla completa (familia C: nuevo/editar pedido, presupuesto, cliente, producto, insumo, evento, venta de mostrador). ES LA DE MÁS RIESGO: los formularios tienen muchas validaciones. Cero cambios de lógica.

1. `components/mobile-form-shell/`: barra superior de formulario a pantalla completa (X «Cerrar sin guardar» con la misma confirmación de descarte que hoy, título, acción de texto opcional a la derecha como «Guardar borrador»), cuerpo con scroll y pie con db-mobile-dock (acciones + slot de ayuda / «Falta: …»). Reemplazá las barras y pies armados por cada formulario (order-form-dialog, quote-form-dialog, customer-form-dialog, product-form-dialog, sale-create/sale-form y los que haya).
2. `components/mobile-form-step/`: título de sección numerada («1 · CLIENTE») + tarjeta; usalo en order/quote form, venta y donde se repita.
3. `components/mobile-stepper/` (− cantidad +, botones 44×44, min/max, aria-labels) y reemplazá los steppers de líneas de pedido/presupuesto, carrito de venta y hoja de entrega.
4. Si el segmentado mobile (Lista/Mayorista, Particular/Empresa/Revendedor, Calculado/Precio fijo…) está copiado con estilos propios en varios formularios, unificalo (db-segmented-control con una variante mobile o db-mobile-chip-group en modo único, lo que deje menos código).
5. Estilos de campos mobile (alto 48px, label, ayuda, error inline) en un solo lugar del kit; borrá las copias.
6. Aprovechá para que `order-form.component.scss` y `linea/order-form-line.component.scss` queden por debajo del budget de 12 kB (moviendo estilos mobile a parciales o a los componentes nuevos).
7. Mismo resultado visual y comportamiento; desktop sin cambios. Actualizá «Si cambiás X, tocá» de la familia C en docs/mobile/familias.md.

Criterio: el de reglas-implementacion.md, sin warnings de budget para esos dos SCSS. Respondé con archivos tocados, líneas eliminadas aproximadas y diferencias.
