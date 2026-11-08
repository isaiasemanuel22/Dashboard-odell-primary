# Errores pendientes · Odell

Errores que Isaías va encontrando al usar la app. Claude los anota acá a medida
que llegan y se corrigen en tandas, cuando haya un rato.

Estado: 🔴 pendiente · 🟡 en curso · ✅ corregido (con fecha y commit).
Vista: desktop, mobile o ambas; «(prod)» si se vio en producción. Si no dice mobile, no se probó ahí.

| # | Fecha | Vista | Pantalla | Qué pasa | Esperado | Estado |
|---|-------|-------|----------|----------|----------|--------|
| E1 | 2026-11-07 | desktop (prod) | Editor de texto enriquecido (rich text) | Las imágenes que se insertan no se guardan | Las imágenes quedan guardadas con el texto | ✅ 2026-11-07 · 2d51a5f |
| E2 | 2026-11-07 | desktop (prod) | Presupuestos y pedidos | No se pueden adjuntar archivos ni imágenes (falta la función, no es una falla) | Poder cargar archivos e imágenes de referencia del cliente o de la propuesta del vendedor | 🔴 mejora |
| E3 | 2026-11-07 | desktop (prod) | Componentes de carga de archivos | Con nombres de archivo muy largos el componente se rompe | El nombre se recorta (o pasa de línea) sin romper el diseño | ✅ 2026-11-07 · 5a04a34 |
| E4 | 2026-11-08 | desktop | Productos › editar producto (sección Precio) | Al abrir un producto para editar, sin tocar nada, el «precio calculado» muestra el precio guardado en vez de calcularlo con el costo y el margen actuales. Causa: al cargar, `computedPrice` se inicia con `product.price` y `keepCatalogPrice = true`, y el recálculo no lo pisa (salvo 3D sin precio sugerido). Ver `product-form-state-manager.service.ts:362` y `product-form-pricing.service.ts:109` y `:463` | El precio calculado se recalcula siempre con costo y margen vigentes; el precio guardado se muestra aparte (o como precio fijo) | ✅ 2026-11-08 · 9983bfe |
| E5 | 2026-11-08 | desktop | Productos › editar estampado (ej. Taza Frozen) | En el mismo formulario hay dos precios calculados: el recuadro verde y «Precio unitario» dicen $10.934 (costo $5.467 × 2), y el aviso de desactualizado y «Calculado $7.434 · margen 36%» dicen $7.434. La diferencia ($3.500) es lo que figura como «Insumos» en el costo. Lo encontró la prueba de E4 | Un único precio calculado, el mismo en todo el formulario y el que se guarda | 🔴 |
| E6 | 2026-11-08 | desktop | Productos › lista vs. editar combo (ej. Arbol de equilibrio) | La lista muestra costo $9.548 y margen 79%; el formulario, costo $7.259 (piezas + armado) y margen 136%. El precio coincide. Lo encontró la prueba de E4 | El mismo costo y margen en la lista y en el formulario | 🔴 |
| E7 | 2026-11-08 | mobile + desktop | Cola › «+ Nueva tarea» (independent-task-dialog) | Los campos quedan pegados entre sí (cada etiqueta junto al input anterior) y el pie no tiene banda como los otros diálogos. Ya pasaba antes del rediseño v2; lo vio la QA de la fase 2 | Separación entre campos y pie con la banda de los demás diálogos | 🔴 |
| E8 | 2026-11-08 | mobile | Clientes › «Nuevo cliente» | El texto «Faltan: …» del pie va al costado de los botones en una columna angosta y estira «Cancelar» y «Crear cliente» a ~100 px de alto. Ya pasaba antes; el aviso que pedía email (opcional) se corrigió en 6c5b47f | El aviso arriba o abajo de los botones, botones de alto normal | 🔴 |
