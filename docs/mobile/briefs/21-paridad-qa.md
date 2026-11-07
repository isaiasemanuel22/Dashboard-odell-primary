Leé primero docs/mobile/reglas-implementacion.md. No cambies comportamiento de desktop ni reglas de negocio. Nunca hagas git commit/add/stash. Si la misma lógica hace falta en dos lugares, extraéla a un helper/servicio compartido.

Correcciones de la QA funcional de paridad mobile:

1. Insumos (mobile): en la hoja «Editar insumo» (modals/supply-form-dialog.component.ts) los botones nuevos «Registrar compra» y «Eliminar» quedan tapados por el dock fijo Cancelar/Guardar y el scroll se frena antes: «Eliminar» es inalcanzable a 375x812. Que todo el contenido del db-mobile-form-shell pueda scrollear hasta el final por encima del dock (padding inferior = alto del dock + safe-area, en el componente compartido si el problema está ahí, para que valga en todos los formularios con dock).
2. Ajustes → Ganancias (mobile): el guard settingsUnsavedChangesGuard no pregunta al volver con cambios (Valores generales sí). Cambiar el margen de un área de 10 a 15 y tocar «‹» sale sin preguntar. Revisá hasUnsavedChanges() de profit-settings (snapshot tomado en el momento equivocado, inputs que no actualizan el modelo comparado, o el botón volver que no pasa por el router) y dejalo funcionando igual que Valores generales. Revisá también Impresos con el mismo criterio.
3. Venta de mostrador, editar una venta ya guardada: si la venta tiene la última unidad de un producto, el editor muestra «quedan 0» y deshabilita «Guardar cambios» con «No hay stock suficiente para cobrar», aunque esas unidades ya están descontadas por la propia venta. Al editar, el stock disponible para cada producto debe ser stock actual + cantidad que ya tenía esa venta (mismo cálculo para el tope del stepper, el «quedan N» y el bloqueo de Cobrar/Guardar). Hacelo en un solo helper.

Verificá `npm run build --prefix frontend` y `grep -rn "font: [0-9][^;]*inherit;" frontend/src` (sin resultados).
Respondé con: archivos tocados y la causa de cada punto.
