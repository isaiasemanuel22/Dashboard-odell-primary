Leé primero docs/mobile/reglas-implementacion.md (en especial «No duplicar: modularizar») y docs/mobile/familias.md (parte 2, puntos 5 a 9 del orden y lo que quedó pendiente de la extracción 4). Ya existen: db-mobile-dock, db-mobile-sheet, db-mobile-chip-group, db-mobile-list-toolbar, db-mobile-card-link, db-mobile-banner, db-mobile-form-shell, db-mobile-form-step, db-mobile-stepper. Usalos.

Tarea: extracciones de menor riesgo, en este orden (si algo no rinde, saltealo y decilo):
1. Ajustes (G1/G2): `db-mobile-settings-page` (barra con volver a /ajustes + cuerpo + dock opcional), `db-mobile-catalog-row` (swatch/ícono, título, subtítulo, valor, acciones) y `db-mobile-field-group` (label + input con prefijo $ o sufijo de unidad). Reemplazá la repetición en general-values, profit-settings, impresos, filament, resin, colors y usuarios (y lo que viva en `_settings-mobile.scss` y `settings-users-mobile-shell`).
2. Detalles (B): `db-mobile-contact-card` (avatar + nombre + pills + WhatsApp/Llamar), `db-mobile-totals` (filas etiqueta/valor con total destacado) y `db-mobile-collapsible` (título, resumen a la derecha, chevron, aria-expanded) en detalle de pedido, presupuesto, cliente y producto.
3. Paneles (E): `db-mobile-kpi-grid`, `db-mobile-period-picker` (Mes/Trimestre/Año o mes con flechas) y `db-mobile-movement-row` en Dashboard, Ventas, Billetera y Calendario si aplica.
4. Índices (F): `db-mobile-nav-list` (grupos de filas con ícono, título, ayuda y link) y `db-mobile-toggle-row` (role switch) en Ajustes y Más.
5. Pendientes de la 4: pies locales de los formularios de cliente, insumo, producto y evento → db-mobile-form-shell / db-mobile-dock; y `db-mobile-select-field` solo si se repite de verdad.
Mismo resultado visual y comportamiento; desktop sin cambios. Al final, actualizá docs/mobile/familias.md («Si cambiás X, tocá» de cada familia tocada) y en docs/mobile/reglas-implementacion.md la lista de componentes mobile disponibles.

Criterio: el de reglas-implementacion.md. Respondé con archivos tocados, líneas eliminadas aproximadas por punto y diferencias.
