Leé primero docs/mobile/reglas-implementacion.md (sección «No duplicar: modularizar»). No toques el markup ni el comportamiento de desktop. Nunca hagas git commit/add/stash.

Paridad mobile, tanda B: funciones de desktop que faltan en mobile. Reutilizá los mismos servicios/helpers/acciones de desktop; en mobile solo agregás UI con los componentes db-mobile-* existentes. Cero cambios de reglas de negocio.

1. Calendario — vista Semana: agregar «Semana» al selector de vista mobile (Agenda / Semana / Mes). A 390px no entra una grilla de 7 columnas: mostrala como la semana actual en lista vertical de 7 días (encabezado del día + sus eventos/entregas, días vacíos en una línea gris «Sin eventos»), con flechas ‹ › para cambiar de semana y «Hoy». Usá los mismos datos/helpers que la vista Semana de desktop.
2. Calendario — filtros: los mismos filtros que desktop (tipo de evento, etc.) en una hoja de filtros mobile con chips, siguiendo el patrón de filtros de Pedidos.
3. Cola — filtro por cliente: igual criterio que desktop, en una hoja de filtros o selector dentro de la Cola mobile.
4. Cola — «Nueva tarea»: el mismo formulario/servicio que desktop, abierto desde la Cola mobile (botón en la barra o el «+» del layout cuando estás en /cola — si usás el FAB, sumalo en layout.component.ts igual que fabOpensQuote/fabOpensCustomer).
5. Cola — mover una tarea a Bloqueado: en la hoja de acciones de la tarea, la misma transición que desktop (y salir de Bloqueado si desktop lo permite).

Actualizá docs/mobile/familias.md (Calendario: mobile ahora tiene Agenda, Semana en lista y Mes).
Verificá `npm run build --prefix frontend` y `grep -rn "font: [0-9][^;]*inherit;" frontend/src` (sin resultados).
Respondé con: archivos tocados, qué reutilizaste de desktop en cada punto y qué no se pudo.
