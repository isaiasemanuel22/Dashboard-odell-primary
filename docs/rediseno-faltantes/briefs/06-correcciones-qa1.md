Leé primero docs/rediseno-faltantes/reglas-implementacion.md y seguilo. Nunca hagas git commit/add/stash/switch.

# Correcciones de la QA visual de desktop (ronda 1)

Trabajá en el worktree /home/icalfin/Escritorio/Proyectos/dashboard-rediseno. Antes de cambiar algo, fijate con
`git diff main -- <archivo>` si el problema lo introdujo esta rama o ya estaba en main.

- Si lo introdujo esta rama, corregilo.
- Si ya estaba en main, corregilo solo cuando sea visual y chico. Si es de lógica, no lo toques y anotalo.

## Alta

1. Venta de mostrador en desktop. Hoy «+ Venta de mostrador» en /ventas y los accesos desde Productos llevan a la página
   vieja /ventas/nueva:
   - `sales.component.html:159-164` (`routerLink`), `sales.component.ts:250` (`openCreateSale`),
     `products.component.html:127` y `products-toolbar.component.html:14`.
   - En desktop (`BreakpointService.isMobile()` falso) tienen que abrir el modal con `FormDialogService.openSale()`
     y refrescar lo mismo que refresca hoy el flujo de venta (lista y carrito).
   - En mobile siguen yendo a /ventas/nueva como hasta ahora.
2. El buscador del modal de venta se ve roto: la lupa queda centrada en una caja vacía y el input cae debajo.
   - Está en `.sale-d__search-box` (`pages/sales/sale-form/sale-form.component.html` cerca de la línea 270 y `.scss` cerca
     de la 75). Probablemente un estilo global de `label` le pisa el `display:flex`.
   - Tiene que quedar como RdVentaMostrador: lupa a la izquierda e input en la misma caja.

## Media

3. Confirmación de peligro: el botón de acción tiene que ser rojo sólido con texto blanco, no de contorno (RdPatrones §2,
   `.btn-d`). Aplica a `app-confirm-lead`/`confirm-dialog`, al anular de billetera y al botón «Resetear base de datos» de
   Ajustes. Revisá qué variante de `db-button` lo da o agregá una variante sólida de peligro. El pie del modal con
   `footerBar` tiene que tener borde superior.
4. Nueva categoría: el `fieldset` «Aplica a» se ve con el borde nativo.
   - Quitale el estilo nativo y dale el de un grupo de campos.
   - Agregá la ayuda «Sólo aparece al cargar productos de ese tipo».
   - Ancho del patrón chico: 480.
5. Nuevo impreso: falta separación vertical entre campos (gap de unos 18 px como RdImpreso) y el ancho tiene que ser 560.
6. Detalle de pedido (RdPedidoDetalle):
   - las tablas «Líneas del pedido» y «Tareas del pedido» no deben tener scroll horizontal a 1440 (ajustá anchos,
     padding o `white-space`, sin sacar columnas);
   - el formulario de Pagos va en grilla de 3 columnas (Monto | Medio | Seña / Cuenta | Comisión | botón);
   - «Historial de estado» e «Historial de precios» van lado a lado;
   - el pie va en fila alineado a la derecha, con «Cancelar pedido» en rojo sólido.
7. Nuevo pedido: en la columna derecha, el segmentado «Medio de pago» de Seña se desborda («Mercado Pago» cortado).
   Que entre, por ejemplo con wrap o columnas parejas.
8. Nuevo pedido y Nuevo presupuesto: el error «Indicá un precio unitario mayor a 0» aparece antes de tocar nada. Tiene que
   aparecer recién cuando el campo fue tocado o se intentó guardar.
9. Nuevo cliente: la tarjeta «Precio mayorista» del Revendedor va justo después de «Tipo de cliente» (V1ModalCliente), no
   al final.
10. Panel de filtros (`db-filter-panel`): mientras el panel está abierto, el botón «Filtros» se muestra con el estilo
    activo (fondo celeste y borde azul).
11. /pedidos: mientras carga se ve el estado vacío («No hay pedidos abiertos») en vez del skeleton. Si lo introdujo esta
    rama, corregilo.

## Baja (si son chicas)

12. Selector de piezas:
    - doble borde en el input: dejá uno solo;
    - «+ Crear pieza nueva» tiene que quedar fijo como pie del desplegable;
    - Escape con el desplegable abierto tiene que cerrar solo el desplegable, sin disparar «Descartar cambios» del modal
      (usá `stopPropagation`).
13. Etiqueta «Nuevo» junto a Seña en Nuevo pedido: si la agregó esta rama, sacala.
14. Placeholders de búsqueda cortados en /pedidos y en otras listas: acortá el texto o ensanchá el campo.

## Al terminar

Corré build, el grep de `font … inherit` y los tests, como dicen las reglas.

Respondé con:
- qué corregiste;
- qué no corregiste y por qué (aclarando si ya estaba en main).
