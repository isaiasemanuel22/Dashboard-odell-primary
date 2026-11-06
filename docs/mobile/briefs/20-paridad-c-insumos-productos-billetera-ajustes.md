Leé primero docs/mobile/reglas-implementacion.md (sección «No duplicar: modularizar»). No toques el markup ni el comportamiento de desktop. Nunca hagas git commit/add/stash.

Paridad mobile, tanda C: funciones de desktop que faltan en mobile. Reutilizá los mismos servicios/helpers/acciones/diálogos de desktop; en mobile solo agregás UI con los componentes db-mobile-* existentes. Cero cambios de reglas de negocio.

1. Insumos — eliminar insumo: en la hoja de acciones/edición mobile, misma confirmación y mismo servicio (store NgRx de insumos, §25.5.6).
2. Insumos — «Registrar compra»: el mismo formulario/servicio que desktop (recordá §9.4: la compra fija el precio del insumo), abierto desde la hoja del insumo en mobile; el formulario en fullscreen mobile como los demás.
3. Productos — adjuntos en el detalle de producto: mostrar y abrir/descargar los adjuntos (y agregar/quitar si desktop lo permite), con la misma lógica que desktop, en una sección db-mobile-collapsible.
4. Productos — «Agregar a pedido»: la misma acción que desktop desde la hoja de acciones del detalle de producto.
5. Billetera — hoja única con pestañas: como desktop, que el detalle/registro de movimientos esté en una sola hoja con pestañas (Ingreso / Egreso / Transferencia o las que tenga desktop) en lugar de hojas separadas; reutilizá db-mobile-chip-group como pestañas.
6. Billetera — nota en transferencias: el mismo campo de nota que desktop al registrar una transferencia, y mostrarla en el detalle del movimiento.
7. Roles — matriz de permisos: la misma información y edición que desktop; a 390px mostrala por rol (lista de roles → al abrir uno, lista de permisos agrupados con db-mobile-toggle-row), mismo servicio de guardado.
8. Ajustes — aviso al salir con cambios sin guardar: en las pantallas de Ajustes mobile con edición (valores generales, ganancias, impresos y las que tengan «Guardar»), si hay cambios sin guardar y el usuario toca volver o navega a otra ruta, preguntar «¿Descartar los cambios?». Hacelo en un solo lugar reutilizable (un guard canDeactivate + el mismo confirm de confirm-mobile-form-discard.ts), no en cada pantalla.
9. Venta de mostrador: dejá el tope del stepper en el stock disponible (docs/BUSINESS-RULES.md: «puede venderse directamente si existe stock»). No lo cambies.

Verificá `npm run build --prefix frontend` y `grep -rn "font: [0-9][^;]*inherit;" frontend/src` (sin resultados).
Respondé con: archivos tocados, qué reutilizaste de desktop en cada punto y qué no se pudo.
