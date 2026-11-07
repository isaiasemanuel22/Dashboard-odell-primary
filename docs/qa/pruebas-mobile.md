# Registro de pruebas · Odell mobile

Casos funcionales del rediseño mobile (≤768 px, celular de 390 px de ancho).
Lo actualiza Claude con cada informe de `odell-tester`; el tester lo lee antes
de probar y repite los casos registrados como regresión.

Resultado: ✅ pasa · ❌ falla · ⏸ no probado. Cada resultado lleva fecha y
commit.

## Datos de prueba

- Usuario: el usuario de prueba local de `.cursor/skills/odell-qa/SKILL.md`.
- Cliente revendedor: «QA Revendedor» (cust-2).
- Pedido de referencia: ord-13.
- Lo que cree el tester lleva el prefijo `QA-`.

## Shell mobile (menú inferior, barra superior, «Más», hojas)

| # | Caso | Pasos | Esperado | Último resultado |
|---|------|-------|----------|------------------|
| S1 | Menú inferior | Entrar a /dashboard | Se ven Inicio, Pedidos, «+», Billetera y Más; Inicio marcado | ✅ 2026-11-02 · shell |
| S2 | Pestañas | Tocar Pedidos, Billetera y Más, una por vez | Cada una abre su pantalla y queda marcada | ✅ 2026-11-02 · shell |
| S3 | Accesos de «Más» | En «Más», tocar cada uno de los 8 accesos y volver | Abren Presupuestos, Ventas, Productos, Insumos, Clientes, Cola, Calendario y Ajustes; «Más» queda marcado en esas secciones | ✅ 2026-11-02 · shell (el marcado de «Más» se agregó después de la prueba) |
| S4 | Tarjeta de usuario | Mirar la parte de arriba de «Más» | Iniciales, nombre (o email) y «Rol · email» si el usuario tiene rol | ✅ 2026-11-02 · shell (el usuario de prueba no tiene nombre ni rol: muestra solo el email) |
| S5 | Sincronizar en tiempo real | Cambiar el interruptor, ir a Inicio, volver | Queda como se dejó | ✅ 2026-11-02 · shell |
| S6 | Nuevo pedido desde «+» | Tocar «+», después la X | Abre a pantalla completa con X y «Crear pedido · $ …» fijo abajo; la X cierra sin crear (pide confirmar si hay datos) | ✅ 2026-11-02 · nuevo pedido |
| S7 | Crear pedido desde «+» | Crear pedido con cliente QA Revendedor, una línea de Impresión 3D y descripción «QA-…» | Lleva a /pedidos y el pedido aparece arriba de la lista | ✅ 2026-11-02 · shell (ord-14) |
| S8 | Menú lateral (pantallas viejas) | En /pedidos, abrir ☰ y cerrar tocando afuera, 3 veces | Responde siempre al primer toque | ✅ 2026-11-02 · shell |
| S9 | Navegar desde el menú lateral | En el menú lateral, tocar Clientes | Se cierra el menú y abre Clientes | ✅ 2026-11-02 · shell |
| S10 | Cerrar sesión | Solo mirar «Más» | La opción está, en rojo, debajo del interruptor (no tocarla) | ✅ 2026-11-02 · shell |

## Dashboard

| # | Caso | Pasos | Esperado | Último resultado |
|---|------|-------|----------|------------------|
| D1 | Barra superior | Entrar a /dashboard | «Hola» o «Hola, <nombre>», ☰ y campana con número; la campana abre la hoja de notificaciones y se cierra tocando afuera | ✅ 2026-11-02 · dashboard |
| D2 | Período | Tocar Mes, Trimestre y Año; comparar con desktop | Cambian Vendido, Cobrado, Ganancia neta y la etiqueta; los 4 números coinciden con desktop (Por cobrar no depende del período) | ✅ 2026-11-02 · dashboard |
| D3 | Por cobrar | Tocar el recuadro «Por cobrar» | Baja a la sección Por cobrar; la suma de las líneas y «Total a cobrar» coinciden con el recuadro | ✅ 2026-11-02 · dashboard (el total se agregó después) |
| D4 | Para hoy | Tocar cada fila y volver | Cada fila lleva a una lista coherente con lo que dice (atrasados, por cobrar, insumos con stock bajo, productos bajo margen) | ✅ 2026-11-02 · dashboard |
| D5 | Producción | Tocar Pendientes y En producción | Pendientes lleva a Pedidos filtrado por pendiente; En producción lleva a Cola de trabajo | ⏸ Pendientes se corrigió después de la prueba |
| D6 | Ingresos, canales y ranking | Mirar el gráfico, tocar «Ver ranking de productos» | Barras de los últimos 6 meses (un mes con monto > 0 nunca queda vacío); el link baja a «Ranking de productos» con los 5 primeros y criterio Ganancia / Margen % / Unidades | ⏸ Ranking y alto mínimo se corrigieron después de la prueba |
| D7 | Por cobrar en desktop | En desktop, tocar el recuadro «Por cobrar» | Baja a la sección Por cobrar | ✅ 2026-11-02 · dashboard |

## Pedidos (lista y filtros)

| # | Caso | Pasos | Esperado | Último resultado |
|---|------|-------|----------|------------------|
| P1 | Barra | Entrar a /pedidos y tocar volver | «Pedidos» y «N abiertos» (total de abiertos, no los visibles); volver lleva al dashboard | ✅ 2026-11-02 · pedidos |
| P2 | Chips | Tocar Abiertos, Atrasados, Para entregar, Con saldo y Todos | La cantidad de tarjetas coincide con el número del chip. Atrasados: entrega vencida y no entregado. Para entregar: terminados. Con saldo: falta cobrar algo y no está cancelado (incluye entregados con deuda y pedidos en curso; «Por cobrar» del dashboard cuenta solo las deudas de pedidos entregados) | ✅ 2026-11-02 · pedidos |
| P3 | Buscador | Buscar por cliente, por n.º (ord-14) y por producto | La lista se acota y se combina con el chip activo | ✅ 2026-11-02 · pedidos |
| P4 | Tarjeta | Comparar 2 tarjetas con su detalle | Coinciden n.º, «1 producto»/«N productos», unidades, cliente, áreas (con nombre, ej. «Diseño gráfico»), entrega, total y la línea de dinero (seña/pagado/saldo o «Sin pagos») | ✅ 2026-11-02 · pedidos (línea de dinero y nombre de área se mejoraron después) |
| P5 | Hoja de filtros | Elegir estado y área, aplicar; reabrir; «Solo con saldo pendiente»; Limpiar; Cancelar | «Ver N pedidos» cambia en vivo y coincide con lo aplicado; «Filtros · N»; las opciones quedan marcadas; Limpiar vuelve a «Filtros»; Cancelar no cambia nada | ✅ 2026-11-02 · pedidos |
| P6 | Pedidos por estado | Entrar a /pedidos?estado=pendiente, y desde el recuadro Pendientes del dashboard | Chip Todos activo y visible, «Filtros · 1», solo pendientes | ✅ 2026-11-02 · pedidos |
| P7 | Abrir detalle y volver | Tocar una tarjeta, después volver | Abre el detalle; al volver la lista conserva chip, filtros, búsqueda y scroll | ✅ abrir 2026-11-02 · ⏸ conservar estado se agregó después |
| P8 | Sin resultados | Buscar «zzzz» | Mensaje claro y botón «Limpiar búsqueda y filtros» | ✅ mensaje 2026-11-02 · ⏸ botón se agregó después |

## Detalle de pedido

| # | Caso | Pasos | Esperado | Último resultado |
|---|------|-------|----------|------------------|
| DP1 | Barra y menú | Volver; tocar «⋯» → Editar y cerrar sin guardar | Volver lleva a la lista; «⋯» ofrece Editar y Cancelar pedido | ✅ 2026-11-02 · detalle |
| DP2 | Resumen | Mirar ord-10, ord-13 y ord-14 | Estado; «Creado d/m · entrega …» en una línea (solo «Vencía d/m» en rojo si está atrasado) y pill «Atrasado N días»; cliente; «Mayorista · −N%» si aplica; WhatsApp y Llamar solo si hay teléfono | ✅ 2026-11-02 · detalle (la línea de fechas se ajustó después) |
| DP3 | Dinero | Comparar Total/Pagado/Saldo con la sección Pagos | Coinciden; la barra refleja el %; «<1 %» si hay algo pagado pero menos de 1 %; «Seña $ …» si hubo seña | ✅ 2026-11-02 · detalle |
| DP4 | Productos | Comparar con el detalle en desktop | Unidades × precio (lista tachada si hay otro aplicado), subtotal y «Preparar: N de M · Entregado: K» coinciden; margen sobre costo cuando el producto tiene costo | ✅ 2026-11-02 · detalle (desktop no muestra margen: sin contraste) |
| DP5 | Acordeones | Abrir y cerrar Pagos, Tareas, Entregas e Historial | Abren y cierran, uno por vez; el resumen de la derecha coincide con el contenido | ✅ 2026-11-02 · detalle (uno por vez se agregó después) |
| DP6 | Registrar pago | En ord-14, «Registrar pago» y cargar $10 en efectivo | Abre Pagos con el saldo precargado; al registrar, Pagado y Saldo se actualizan | ✅ 2026-11-02 · detalle (pago QA de $10 en ord-14) |
| DP7 | Entregar | En ord-13, «Entregar» (sin confirmar) | «Entregar ahora» abre una hoja: si hay unidades listas, el formulario de entrega; si no hay nada listo, aviso explicando por qué no se puede entregar | ✅ 2026-11-02 · detalle (hoja + aviso sin unidades listas) |
| DP8 | Sin cliente y alertas | ord-10 | «Sin cliente» + «Asignar cliente» (con Cancelar); varias alertas en «Atención (N)» con «Ver todas» | ✅ 2026-11-02 · detalle (Cancelar se agregó después) |
| DP9 | Toques | Recorrer botones y casillas | Todo cómodo de tocar (≥44 px) | ✅ 2026-11-02 · detalle |

## Nuevo pedido

| # | Caso | Pasos | Esperado | Último resultado |
|---|------|-------|----------|------------------|
| NP1 | Faltantes | Tocar «+» y completar de a poco | «Crear pedido · $ …» deshabilitado con «Falta: …» que se achica; al final la nota de estado Pendiente | ✅ 2026-11-02 · nuevo pedido |
| NP2 | Cliente revendedor | Elegir «QA Revendedor»; alternar Lista/Mayorista | Badge «Revendedor · −N%» y tipo de precio Mayorista; se puede cambiar | ✅ 2026-11-02 · nuevo pedido |
| NP3 | Línea | Impresión 3D «QA-…», 20 g de filamento, cantidad 2 con + | Precio c/u, Subtotal (= cantidad × c/u) y Total se actualizan; la composición se pliega/despliega | ✅ 2026-11-02 · nuevo pedido |
| NP4 | Seña | Mirar sugerida; alternar medios | «N % del total» dentro de la caja; Efectivo/Transferencia/Mercado Pago completos; la cuenta acompaña al medio | ✅ 2026-11-02 · nuevo pedido |
| NP5 | Resumen | Mirar el resumen | Total, Ganancia estimada y Saldo al entregar (= Total − seña) alineados a la derecha | ✅ 2026-11-02 · nuevo pedido |
| NP6 | Compra mínima mayorista | Con total menor al mínimo | Aviso de que se cobra precio de lista | ✅ 2026-11-02 · nuevo pedido |
| NP7 | Crear | «Crear pedido · $ X» y abrir el pedido | Lleva a /pedidos con el pedido arriba; el detalle coincide con lo cargado | ✅ 2026-11-02 · nuevo pedido (ord-15) |
| NP8 | Descartar | Cargar algo y tocar la X | Pide confirmar; «Seguir editando» vuelve; «Descartar» cierra sin crear | ✅ 2026-11-02 · nuevo pedido |
| NP9 | Editar | Desde el detalle, «⋯» → Editar y cerrar | Pantalla completa «Editar pedido» con los datos y «Guardar cambios · $ …»; sin cambios cierra sin preguntar | ✅ 2026-11-02 · nuevo pedido |

Ajustes del 2026-11-02 (decisiones del usuario), probados ✅: la seña arranca en Efectivo / Caja efectivo; con total bajo la compra mínima del cliente aparece «No aplica: no llega a la compra mínima de este cliente» junto a Mayorista; al editar un pedido atrasado el faltante dice «nueva fecha de entrega (la actual ya pasó)».

Observaciones de Nuevo pedido: con el aviso de compra mínima activo, «Mayorista −N%» sigue marcado aunque se cobra lista; la seña arranca en Transferencia. La seña sugerida del 50 % y el medio por defecto quedan por definir.

## Billetera

| # | Caso | Pasos | Esperado | Último resultado |
|---|------|-------|----------|------------------|
| B1 | Disponible total | Comparar con desktop | Mismo monto; si es negativo, se aclara «saldo negativo» | ✅ 2026-11-02 · billetera |
| B2 | Cuentas | Comparar con desktop y tocar cada cuenta | Mismos disponibles; tocar una filtra los movimientos; «Todas» vuelve | ✅ 2026-11-02 · billetera |
| B3 | Buscar | Lupa, buscar una palabra, borrar | La lista se acota; una sola ✕ borra | ✅ 2026-11-02 · billetera (la ✕ duplicada se quitó después) |
| B4 | Movimientos | Mirar la lista | Agrupados por día; ingresos verdes, egresos rojos con «−», transferencias neutras, anulados tachados; 20 y «Ver más» | ✅ 2026-11-02 · billetera (sin datos de comisión ni transferencia vigente) |
| B5 | Menú de movimiento | Tocar un movimiento y «Cerrar» | Título, monto y fecha; acciones de desktop (Editar/Anular, o Ver pedido / Ver venta con aclaración); el menú inferior no tapa nada | ✅ 2026-11-02 · billetera |
| B6 | Pagar / prestar | Abrir y elegir Pagar; cancelar | Opciones sin taparse; el formulario abre y cancela | ✅ 2026-11-02 · billetera |
| B7 | Registro y Transferir | Abrir y cancelar | Abren su formulario (todavía el de desktop) | ✅ 2026-11-02 · billetera |
| B8 | Te deben | Comparar con desktop; «Registrar devolución» y cancelar | Mismos deudores y montos; botón de 44 px; precarga el monto | ✅ 2026-11-02 · billetera |

## Productos (lista y filtros)

| # | Caso | Pasos | Esperado | Último resultado |
|---|------|-------|----------|------------------|
| PR1 | Barra | Volver; tocar «+» y cerrar | Volver lleva a «Más»; «+» abre Nuevo producto | ✅ 2026-11-02 · productos |
| PR2 | Tarjeta | Comparar precios, costo y margen con desktop | Coinciden; margen = (precio − costo) ÷ costo con «N %»; barra roja exactamente en los productos de «Bajo margen» y franja mínima si el margen es negativo | ✅ 2026-11-02 · productos (el color se alineó con «Bajo margen» después) |
| PR3 | Chips | Tocar cada chip | «Todos N», «Bajo margen N»…; la cantidad coincide; los de 0 no aparecen (salvo Todos y el activo) | ✅ 2026-11-02 · productos |
| PR4 | Tipo y categoría | Elegir tipo y categoría, aplicar, Limpiar | «Ver N productos» coincide; «Tipo y categoría · 2»; los chips se recalculan; Limpiar vuelve todo | ✅ 2026-11-02 · productos |
| PR5 | Buscador | Buscar por nombre | Se combina con chips y filtros; los contadores se ajustan | ✅ 2026-11-02 · productos |
| PR6 | Precios desactualizados | Mirar el aviso (no tocar Recalcular) | El número coincide con los visibles; Recalcular a la derecha | ✅ 2026-11-02 · productos |
| PR7 | Detalle y volver | Bajar, abrir una tarjeta y volver | Se conservan chip, filtros, búsqueda y posición del scroll | ✅ 2026-11-02 · productos (el scroll se corrigió después; también en Pedidos) |
| PR8 | Filtro por URL | /productos?filtro=below_margin | Abre con «Bajo margen» activo | ✅ 2026-11-02 · productos |

Inaccesible en mobile por ahora (resolver al migrar detalle/producto/ventas): actualizar precios en bloque, cambios de precio de insumos y carrito. Observaciones: las tarjetas no marcan cuáles son los precios desactualizados; «N piezas» (compuesto) vs «Stock N» en desktop.

Sin probar todavía: opciones de Entrega (Hoy / Esta semana / Atrasados) de la hoja, y chip + estado contradictorios (ej. Abiertos + Entregado).

Observaciones del 2026-11-02, a resolver al migrar cada pantalla:

- Nuevo pedido: el primer producto aparece desplegado con 0 g y Crear pedido queda deshabilitado sin decir por qué.
- Las pantallas viejas siguen con ☰ y menú lateral además del menú inferior: es transitorio, hasta que se migren.
- Una vez, un toque inmediato en un acceso de «Más» no respondió; al repetirlo funcionó. No se pudo reproducir.
- Cola: «Agregar al tablero» pasa la tarea de backlog al tablero dentro de Por hacer; no cambia de pestaña.

## Fallos abiertos

| Pantalla | Fallo | Encontrado | Estado |
|----------|-------|------------|--------|
| Nuevo pedido (desktop y mobile) | Los botones de medio de pago cortan el texto («ransferenc», «lercado Pag») | 2026-11-02 · QA visual | Resuelto 2026-11-02 · nuevo pedido |

## Ronda final (2026-11-06) · QA por familias y pruebas funcionales

Guía: `docs/mobile/familias.md`. QA visual en 4 rondas (piezas compartidas + A, B + D, C, E + F + G + únicas) y prueba funcional en 2 partes; correcciones en los commits `d121eb2`, `7f0ea85`, `cce73a8`, `be391c4`, `eb50974` y el de la parte 2.

| # | Caso | Pasos | Esperado | Último resultado |
|---|------|-------|----------|------------------|
| F1 | Enter no envía | En un formulario completo y válido (cliente, pedido), Enter en un campo de texto | No guarda ni cierra; solo guarda el botón (Ctrl/Cmd+Enter envía) | ✅ 2026-11-06 |
| F2 | Listas hasta el final | Bajar hasta el último ítem en Presupuestos y Clientes | El último ítem se ve completo sobre el menú inferior | ✅ 2026-11-06 |
| F3 | Refresco tras crear | Crear con «+» estando en la lista | Aparece sin recargar | ✅ presupuesto 2026-11-06 · ⏸ pedido |
| F4 | Volver al origen | Cola → Detalle → volver | Vuelve a la Cola en la misma pestaña | ✅ 2026-11-06 |
| F5 | Atajos de pago | Registrar pago: Todo el saldo / 50 % / Otro monto | Completan saldo, mitad y vacían el campo | ✅ 2026-11-06 |
| F6 | Formularios nuevos | Crear presupuesto, cliente, insumo y evento QA | Faltantes, Enter, descartar con la X y aparición en su lista | ✅ crear · ❌→corregido descartar en insumo y evento |
| F7 | Venta de mostrador | 1 unidad en efectivo | Stock −1; aparece en Ventas, Billetera y Dashboard | ✅ 2026-11-06 |
| F8 | Ajustes sin guardar | Abrir editores y cerrar | No cambia nada; color en uso sin «Eliminar» | ✅ 2026-11-06 |
| F9 | Calendario | Semana, Agenda/Mes, evento QA en su día | Se ve en Agenda y en Mes | ✅ 2026-11-06 |

Datos QA creados en la ronda final: ord-16 «QA-movil final» (seña $261), pago $10 en ord-15, quo-14 «QA-presu movil» (borrador), cliente «QA-cliente movil», insumo «QA-insumo movil», evento «QA-evento movil», venta de mostrador de 1 × QA-Revalid FDM ($700).

Por definir con el usuario: avisar al salir de Ajustes con cambios sin guardar; venta que supera el stock (hoy el stepper se limita al stock).

## Paridad con desktop (2026-11-07)

Funciones de desktop agregadas a mobile en `e3dcf79`, `fac55ca` y `55f212a`; correcciones de esta prueba en el commit siguiente.

| # | Caso | Pasos | Esperado | Último resultado |
|---|------|-------|----------|------------------|
| P1 | Presupuesto a Borrador | Presupuesto Enviado → «⋯» → Volver a borrador | Pasa a Borrador | ✅ 2026-11-07 |
| P2 | Filtro por área en Presupuestos | Filtros → Área | Lista, botón «Ver N» y contador del filtro responden | ✅ 2026-11-07 |
| P3 | Filtros de Ventas | Filtros → Tipo / Área | Filtra; vacío con «Limpiar filtros» | ✅ 2026-11-07 |
| P4 | Crear pedido desde venta | Nueva venta con carrito → «⋯» → Crear pedido | Nuevo pedido con los productos precargados (solo al armar la venta, igual que desktop) | ✅ 2026-11-07 |
| P5 | Eliminar venta | Venta QA → «⋯» → Eliminar venta | Confirma, sale de la lista y devuelve el stock | ✅ 2026-11-07 |
| P6 | Calendario Semana y filtros | Agenda / Semana / Mes; ‹ › y Hoy; Filtros → Tipo | Semana en lista de 7 días; filtra por tipo | ✅ 2026-11-07 |
| P7 | Cola: filtro y Nueva tarea | Filtro por cliente; «+» en /cola → Nueva tarea | Filtra; la tarea aparece sin recargar | ✅ 2026-11-07 |
| P8 | Cola: mover a Bloqueado | «⋯» de una tarea propia → Mover a Bloqueado → volver a En proceso | Cambia de columna (solo responsable o admin, §12.2) | ⏸ probar con un administrador |
| P9 | Insumo: compra y eliminar | Hoja del insumo → Registrar compra / Eliminar | Compra abre Billetera en la pestaña Compra; Eliminar se alcanza sobre el dock, confirma y lo quita | ❌→✅ 2026-11-07 |
| P10 | Adjuntos de producto | Detalle → Archivos adjuntos | Se ve y se abre | ✅ 2026-11-07 |
| P11 | Billetera, hoja única | Nuevo movimiento → Ingreso / Egreso / Compra / Transferir | Campos correctos en cada pestaña, nada mezclado | ✅ 2026-11-07 |
| P12 | Roles | Ajustes → Roles → permisos por área | Interruptores responden; cerrar sin guardar no cambia nada | ✅ 2026-11-07 |
| P13 | Ajustes sin guardar | Valores generales y Ganancias: cambiar sin guardar y tocar «‹», entrando por link directo y desde Ajustes | Pregunta «Descartar cambios»; Seguir editando conserva el valor y la URL; sin cambios vuelve sin preguntar | ❌→✅ 2026-11-07 |
| P14 | Editar venta con la última unidad | Editar una venta guardada que se llevó la última unidad | Muestra el stock contando las unidades de la propia venta y deja guardar | ❌→corregido (sin volver a probar) |

Causas corregidas: el «‹» usaba `history.back` aunque se hubiera entrado por link directo y salía de la app sin pasar por el guard (ahora solo vuelve con el historial si la navegación anterior es de la app); la confirmación del guard se cerraba con la propia navegación (`keepOnNavigation`); el contenido del `db-mobile-form-shell` no scrolleaba por encima del dock.

Datos QA: quo-15 «QA-paridad» (Borrador), tarea «QA-tarea paridad» (Por hacer, sin responsable); se borraron la venta sale-11 y el insumo «QA-insumo movil».

Para revisar (confuso, igual que desktop): tarjetas de resumen de Ventas que no siguen los filtros; confirmación de eliminar venta con el código interno; tarea nueva sin responsable por defecto; «Aceptar y crear pedido» visible en Borrador.
