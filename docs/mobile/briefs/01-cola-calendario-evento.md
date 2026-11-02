Leé primero docs/mobile/reglas-implementacion.md y seguilo al pie de la letra (rediseño mobile ≤768px de Odell; desktop no cambia).

Tarea: versión mobile de tres piezas, según sus artboards:
1. Cola de trabajo (/cola, frontend/src/app/pages/print-jobs/**) → docs/mobile/artboards/MobCola.dc.html.
   - Barra: volver a '/dashboard', título «Cola de trabajo», lupa que muestra/oculta un buscador (m-search) para filtrar tareas.
   - Pestañas de estado en grilla de 4 (número arriba 15px 700, etiqueta 13px; activa en #0E7AAB con borde inferior 3px) con los estados/columnas que hoy tenga la cola (mapealos a las del artboard si existen: por hacer, en proceso, revisión, terminadas; si la app tiene otros nombres, usá los de la app).
   - Chips de área (Todas + áreas existentes).
   - Tarjetas de tarea: «ord-X · cliente» + prioridad/estado a la derecha (rojo si bloqueada o alta/atrasada), título 15px 700, detalle 12px (motivo de bloqueo, cantidades), área con su color, responsable (iniciales en círculo 28px) o fecha de entrega; tarjetas bloqueadas con borde #F3B4B4 y fondo #FFFBFB. Botones de acción de 44px con las MISMAS acciones que ofrece hoy la cola para cada tarea (ej. Iniciar / Empezar / Terminar / Detalle): primario #0E7AAB y secundario con borde. No inventes acciones.
   - Si la cola usa drag & drop en desktop, en mobile se reemplaza por esos botones de acción.
2. Calendario (/calendario, frontend/src/app/pages/calendar/**) → docs/mobile/artboards/MobCalendario.dc.html.
   - Barra: volver a '/dashboard', título «Calendario», botón de texto «Hoy».
   - Tira de semana: título «2 – 8 de noviembre» con flechas anterior/siguiente; 7 días (nombre corto + número, 58px de alto, el elegido fondo #0E7AAB) con un puntito del color del tipo de lo que hay ese día.
   - Selector Agenda / Semana / Mes: implementá Agenda (lista por día de la semana visible con encabezado «LUNES 2 · HOY», tarjetas con hora a la izquierda, barra de color de 4px, título y detalle; atrasados en rojo; días vacíos «Sin entregas ni eventos»). «Semana» y «Mes» en mobile pueden mostrar la vista que ya existe en desktop si entra en 390px; si no entra, dejá solo Agenda y Mes, y decilo.
   - Tocar una entrega de pedido abre el pedido; tocar un evento abre su edición como hoy.
   - Botón flotante «+ Evento» (52px, radio 16, #0E7AAB, abajo a la derecha por encima del menú inferior) que abre el alta de evento.
3. Nuevo evento (hoja) → docs/mobile/artboards/MobNuevoEvento.dc.html: es el diálogo existente shared/form-dialogs/calendar-event-dialog.component.*; en mobile ya sale como hoja inferior. Ajustá solo su layout mobile al artboard: selector Evento/Recordatorio (si existe ese concepto en el modelo; si no, omitilo), título, «Todo el día» como interruptor, Desde/Hasta en 2 columnas, Repetir como opciones en píldoras, Avisarme y Vincular a en 2 columnas si existen, y pie con un único botón primario «Guardar evento» (Cancelar con la X de arriba). Mantené las mismas validaciones y datos.

Criterio: el de reglas-implementacion.md. Respondé con archivos tocados, decisiones y lo que haya quedado sin implementar o inaccesible en mobile.
