Leé primero docs/rediseno-faltantes/reglas-implementacion.md y seguilo. Nunca hagas git commit/add/stash.

Grupo 5 · Alinear al diseño ya aprobado (desktop). Mobile no se toca.

1. Nuevo/editar pedido: pages/orders/order-form (+ modals/order-form-dialog). Artboards ModalPedido.dc.html y V1ModalPedido.dc.html (variante revendedor). Encabezado con subtítulo, líneas de trabajo como tarjetas con borde izquierdo del color del servicio y selector de servicio en pastillas, totales en caja, pie con texto de estado + Cancelar/Crear. Reemplazá los ~24 hex por tokens.
2. Nuevo presupuesto: modals/quote-form-dialog (template inline sin db-*). Artboard ModalPresupuesto.dc.html. Pasalo a db-*; mismo patrón de líneas que el pedido (si hay markup de línea repetido entre pedido y presupuesto, extraé componente compartido sin cambiar lógica).
3. Nuevo cliente: modals/customer-form-dialog (inline sin db-*). Artboard V1ModalCliente.dc.html (tipo de cliente segmentado, bloque mayorista para revendedor, validaciones inline). Solo los campos que existen hoy.
4. Ajustes › Usuarios: pages/settings/user-access/user-access-layout (23 hex, sin db-*). Artboard AjustesUsuarios.dc.html: encabezado de sección, pestañas Usuarios/Roles/Áreas como chips, buscador. Tokens en vez de hex.
