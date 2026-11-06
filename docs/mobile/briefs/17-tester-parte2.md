Leé primero docs/mobile/reglas-implementacion.md (corregí en los componentes compartidos cuando el problema esté ahí).

Correcciones de la prueba funcional mobile, parte 2. Cero cambios de reglas de negocio.

1. Confirmación de descarte: el formulario de Insumo («+» en /insumos) y el de Evento («+ Evento» en /calendario) se cierran con la X sin preguntar aunque tengan cambios. Unificá: la confirmación de descarte vive en un solo lugar para todos los formularios mobile (db-mobile-form-shell / db-mobile-sheet usados como formulario) con la misma lógica que pedido/presupuesto/cliente (preguntar solo si hay cambios respecto de los valores iniciales).
2. «Falta: …» en el pie de todos los formularios con botón deshabilitado, con el mismo componente (slot de ayuda de db-mobile-dock): Cliente («Crear cliente» gris sin explicación), Evento («Guardar evento») e Insumo (hoy «Faltan: nombre, marca, color.» queda fuera de vista; ponelo en el pie junto al botón y que el botón se vea deshabilitado mientras falte algo, sin cambiar qué campos son obligatorios).
3. Venta de mostrador: el stepper de cada producto no debe pasar del stock disponible («quedan N»): máximo = stock; si se intenta, aviso corto «No hay más stock». Si «Cobrar» queda deshabilitado, decir por qué en el pie.
4. Scroll al volver en Productos sigue intermitente (falló 1 de 2 veces). Investigá qué es distinto en Productos (carga en dos pasos, alertas que aparecen después, imágenes sin alto reservado que cambian la altura después de restaurar…) y hacé que la restauración sea estable: por ejemplo, reservar el alto de las imágenes (aspect-ratio/alto fijo del thumb) y volver a aplicar la posición si la altura del documento cambia durante ~1,5 s después de restaurar mientras el usuario no haya scrolleado.
5. docs/mobile/familias.md: en Calendario y en la guía de QA, aclarar que mobile tiene Agenda y Mes (Semana no entra a 390px); en Impresos, describir lo que hay (pliegos de referencia + lista de impresos).

Criterio: el de reglas-implementacion.md. Respondé con archivos tocados, causa del punto 4 y qué no se pudo.
