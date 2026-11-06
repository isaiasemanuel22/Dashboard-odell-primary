Leé primero docs/mobile/reglas-implementacion.md (en especial «No duplicar: modularizar»: si algo se repite, va a un componente compartido o se corrige en el que ya existe).

Correcciones de la QA visual, ronda 2 (detalles y hojas). Desktop no cambia. Cero cambios de reglas de negocio.

1. Registrar pago (order-detail-payments, `presentation==='sheet'`), según docs/mobile/artboards/MobRegistrarPago.dc.html:
   - Monto grande: input de 30px, centrado, con subrayado, mostrando el valor formateado «$ 26.845» (al editar, numérico; reusá el formateo de moneda de la app). Si sirve para Transferir también, hacelo componente compartido `db-mobile-amount-input`.
   - Atajos debajo del monto con db-mobile-chip-group (selección única): «Todo el saldo» (= saldo actual), «50 %» (= mitad del saldo, redondeado como la app redondea montos) y «Otro monto» (deja editar). Son atajos que solo completan el monto; no cambian ninguna regla.
   - «Es una seña» como interruptor (db-mobile-toggle-row / role switch) en lugar de checkbox, mismo binding.
2. Hojas de Billetera (wallet-transfer-form, wallet-record-form, pago/préstamo) en mobile, sin cambiar su lógica: Desde/Hacia en 2 columnas con «Saldo $ X» debajo de cada cuenta (dato que ya tenga el overview); monto con el mismo `db-mobile-amount-input`; fecha mostrada como «Hoy, 6 nov ▾» cuando es hoy (el control sigue siendo el mismo); la nota explicativa abajo en caja informativa; sacá la caja «Monto a transferir $0» si duplica el monto; botón principal a ancho completo, primario mobile, con el monto en el texto («Transferir $ 20.000», «Guardar $ X»). Usá db-mobile-sheet/db-mobile-dock.
3. Hojas en general (db-mobile-sheet y los diálogos CDK en mobile): bloquear el scroll de la página de fondo mientras una hoja está abierta (incluida la rueda del mouse), restaurándolo al cerrar. Menús «⋯» de cliente y producto con botón «Cerrar» como los de pedido y presupuesto (que lo agregue db-mobile-sheet por defecto en menús de acciones).
4. Detalle de producto: en «Composición del costo» mostrá el monto de cada fila a la derecha y su detalle («$ 10.036 / kg», «$ 1.000 / h») y la fila de «Margen de error · N %» usando el mismo cálculo de costo que ya usa la app (product-detail-production / servicio de costos); si un monto no está disponible sin recalcular, no lo inventes y decilo. «Margen 184 % · objetivo 100 %» sin que el % quede solo en otra línea (espacio no separable).
5. Ficha de cliente: «Comprado» que no contradiga la lista: si cuenta solo terminados/entregados, que el texto lo diga («$ X · N entregados»).
6. Presupuesto: si las líneas no tienen costo cargado, «Ganancia estimada» muestra «Sin costo cargado» en vez de igualar el total. Estilo de totales como el artboard: «Ganancia estimada» y «Seña sugerida» como hint (12px secundario) y el valor de la seña en color de texto normal; margen superior de la descripción como el resto de secciones. El CTA «Aceptar y crear pedido» no debe partirse en 2 líneas a 390px (achicá padding/tamaño en db-mobile-dock si hace falta, para todos).
7. Detalle de pedido: la pill de mayorista dice «Revendedor · −N%» como el artboard cuando el cliente es revendedor y se aplicó mayorista; atrasado (ord-10): pills en una fila y la línea de fechas sin pasarse del padding (texto que pueda cortar con ellipsis o bajar ordenado).
8. Entregar: «Cobrar antes de entregar» a ancho completo, botón secundario blanco con borde.
9. Pedido no encontrado (/pedidos/ord-999): en mobile mostrar db-mobile-bar con volver a /pedidos en vez del header con hamburguesa.
10. Lista de pedidos: «N abiertos» de la barra pasa a reflejar lo visible cuando hay filtros o búsqueda («2 de 6 abiertos»).
11. db-mobile-collapsible: `aria-controls` apuntando al contenido y nombre accesible del botón (título + resumen).
12. Filtros de pedidos: orden de Área como el artboard: Impresión 3D, Estampado, Diseño gráfico, Modelado (si el orden sale de SERVICE_TYPE_LABELS y afecta desktop, ordená solo en la hoja mobile).
13. Teléfono en la ficha de cliente con formato legible (si ya existe un helper de formato de teléfono en la app, usalo; si no, uno simple para números argentinos que no altere el dato guardado).

Criterio: el de reglas-implementacion.md. Respondé con archivos tocados y qué no se pudo resolver.
