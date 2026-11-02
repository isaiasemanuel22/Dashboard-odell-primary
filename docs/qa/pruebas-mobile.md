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

Observaciones del 2026-11-02, a resolver al migrar cada pantalla:

- Nuevo pedido: el primer producto aparece desplegado con 0 g y Crear pedido queda deshabilitado sin decir por qué.
- Las pantallas viejas siguen con ☰ y menú lateral además del menú inferior: es transitorio, hasta que se migren.
- Una vez, un toque inmediato en un acceso de «Más» no respondió; al repetirlo funcionó. No se pudo reproducir.

## Fallos abiertos

| Pantalla | Fallo | Encontrado | Estado |
|----------|-------|------------|--------|
| Nuevo pedido (desktop y mobile) | Los botones de medio de pago cortan el texto («ransferenc», «lercado Pag») | 2026-11-02 · QA visual | Abierto: se corrige al migrar Nuevo pedido |
