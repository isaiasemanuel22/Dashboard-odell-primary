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
