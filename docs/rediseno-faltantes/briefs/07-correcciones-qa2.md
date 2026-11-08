Leé primero docs/rediseno-faltantes/reglas-implementacion.md y seguilo. Nunca hagas git commit/add/stash/switch.

# Correcciones de la QA visual, ronda 2

Las referencias son los artboards de `docs/rediseno-faltantes/artboards/`.

## Alta

1. **Segmentado «Medio de pago» que se desborda (Efectivo / Transferencia / Mercado Pago)**
   - Dónde pasa:
     - En el formulario de Pagos del detalle de pedido (`order-detail-payments`, grilla de 3 columnas): «Mercado Pago» se corta y el checkbox «Seña» queda encima del segmentado.
     - En la Seña de Nuevo pedido (`order-form-order-summary`): «Transferencia» se parte a mitad de palabra.
   - Cómo tiene que quedar:
     - Ninguna opción se corta ni se parte: `white-space: nowrap` y que el segmentado ocupe el ancho de su celda.
     - En el detalle, dale al segmentado una columna lo bastante ancha (por ejemplo, que abarque dos columnas de la grilla o una columna propia más ancha) y alineá el checkbox Seña abajo con los inputs (`align-items: end`, alto 40).
     - En la Seña, si no entra en una fila, el segmentado va en su propia fila de ancho completo, con opciones de ancho parejo y fuente de 13 px.
   - Mismo tamaño de label que los otros campos.
2. **Buscador del selector de piezas en mobile (pantalla completa)**
   - Hoy la lupa queda arriba y el input abajo, con doble borde.
   - Tiene que ser una sola caja con la lupa a la izquierda, como `.m-search` en las otras pantallas mobile (MobRdSelectorPiezas).
   - Archivo: `components/product-piece-picker/`.

## Media (mobile, comparar con MobRd*)

3. **Confirmación en mobile (anular movimiento, `wallet-void-form` y `confirm-dialog`)**
   - El botón Cancelar tiene que verse: Cancelar a la izquierda y la acción a la derecha, como MobRdConfirmacion.
   - Si `wallet-form.scss` oculta Cancelar en mobile, hacé la excepción para estas hojas de confirmación.
   - La acción de peligro sigue en rojo sólido.
4. **Registrar devolución en mobile (`wallet-repayment-form`)**
   - Tiene que verse el encabezado con el deudor y «Deuda pendiente», que hoy está oculto en mobile.
   - Botón Cancelar visible.
   - Fecha y Cuenta en 2 columnas.
5. **Nueva categoría (desktop y mobile)**
   - «Aplica a» queda pegado al input Nombre. Usá el mismo gap que entre los demás campos y el mismo estilo de label.
   - En mobile, los checkboxes van en lista vertical: un ítem por fila de 44 px, casilla de 20 px y texto alineado (MobRdCategoria).
6. **Nueva tarea en mobile (`independent-task-dialog`)**
   - Espaciado parejo entre campos.
   - Fecha límite y Horas estimadas en 2 columnas.
7. **Nuevo impreso en mobile**
   - Ancho y Largo en 2 columnas.
   - «Tipo de papel» como control segmentado (`db-segmented-control`) solo en mobile, con las mismas opciones y el mismo valor. En desktop queda el select.
8. **Exportar presupuesto en mobile**
   - Pie en una sola fila: Cancelar (secundario neutro, no celeste), «Descargar PNG» con borde y «Descargar PDF» primario (MobRdExportarPdf).

## Baja

9. **Nuevo evento en mobile:** el texto «Falta: título» va dentro del pie, arriba del botón Guardar, no debajo.

## Al terminar

- Corré build, el grep de `font … inherit` y los tests, como dicen las reglas.
- Respondé con qué corregiste y qué no, y por qué.
