Leé primero docs/rediseno-faltantes/reglas-implementacion.md y seguilo. Nunca hagas git commit/add/stash.

Grupo 1 · Panel de filtros en desktop (RdPatrones.dc.html §3 y RdFiltros.dc.html).

Hoy las hojas de filtros (frontend/src/app/modals/order-filters-sheet, quote-filters-sheet, sale-filters-sheet, product-filters-sheet, print-job-filters-sheet, calendar-filters-sheet) usan 6 hex sueltos cada una y en desktop se ven como modal viejo.

Objetivo:
1. Crear un componente compartido de panel de filtros para desktop (p. ej. components/filter-panel): botón disparador «Filtros» con contador de filtros activos (estilo resaltado cuando hay alguno), panel desplegable de ~360 px anclado debajo del botón (no modal centrado), encabezado «Filtrar <entidad>» + «Limpiar», grupos con título en mayúsculas chicas y chips, pie con Cancelar y «Ver N <entidad>» (o el label que ya calcula cada hoja). Cierra con Escape y clic afuera; foco accesible.
2. Usarlo en desktop en las 6 pantallas donde hoy se abren esas hojas (o donde desktop tenga sus filtros equivalentes), con exactamente las mismas opciones y lógica de cada hoja (reusá sus draft/apply/clear). En mobile la hoja inferior actual queda igual.
3. Sacar los hex sueltos de las 6 hojas a tokens.
Si alguna pantalla desktop hoy no abre la hoja sino que tiene chips inline propios, decidí lo mínimo para que quede consistente con §3 sin perder funciones y explicalo.
