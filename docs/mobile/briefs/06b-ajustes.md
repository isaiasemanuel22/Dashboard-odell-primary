Leé primero docs/mobile/reglas-implementacion.md y seguilo al pie de la letra (rediseño mobile ≤768px de Odell; desktop no cambia). Ya hay pantallas migradas como referencia (ver ese archivo).

Tarea: Ajustes mobile.
1. Ajustes (/ajustes y sus hijas: valores-generales, filamento, resina, colores, impresos, ganancias, usuarios/roles/areas; pages/settings/**) → MobAjustes.dc.html (índice en filas con ícono, título y resumen que lleva a cada subpantalla; en mobile /ajustes muestra ese índice en lugar de redirigir a la primera) y MobAjustesGeneral, MobAjustesMateriales (patrón para filamento y resina), MobAjustesColores, MobAjustesImpresos, MobAjustesGanancias, MobAjustesUsuarios: cada subpantalla con db-mobile-bar (volver a /ajustes) y sus formularios/tablas convertidos a tarjetas y filas usables a 390px, con un botón Guardar fijo abajo donde hoy haya guardar. El menú lateral de ajustes (settings-layout) se oculta en mobile. Misma lógica, mismos servicios; el reseteo de base y lo que sea solo admin sigue igual.

Criterio: el de reglas-implementacion.md. Respondé con archivos tocados, decisiones y lo que quede pendiente.
