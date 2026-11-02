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
| S6 | Hoja de nuevo pedido | Tocar «+», después Cancelar | Abre desde abajo con Cancelar y Crear pedido visibles sin bajar; Cancelar cierra sin crear | ✅ 2026-11-02 · shell |
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

Sin probar todavía: opciones de Entrega (Hoy / Esta semana / Atrasados) de la hoja, y chip + estado contradictorios (ej. Abiertos + Entregado).

Observaciones del 2026-11-02, a resolver al migrar cada pantalla:

- Nuevo pedido: el primer producto aparece desplegado con 0 g y Crear pedido queda deshabilitado sin decir por qué.
- Las pantallas viejas siguen con ☰ y menú lateral además del menú inferior: es transitorio, hasta que se migren.
- Una vez, un toque inmediato en un acceso de «Más» no respondió; al repetirlo funcionó. No se pudo reproducir.

## Fallos abiertos

| Pantalla | Fallo | Encontrado | Estado |
|----------|-------|------------|--------|
| Nuevo pedido (desktop y mobile) | Los botones de medio de pago cortan el texto («ransferenc», «lercado Pag») | 2026-11-02 · QA visual | Abierto: se corrige al migrar Nuevo pedido |
