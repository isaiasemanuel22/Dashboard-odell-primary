# Bitácora de Odell

Una entrada por tarea cerrada, la más nueva arriba. Solo se agregan entradas;
las viejas no se editan. Cuando pase de ~40 entradas, las más viejas se
mueven a `BITACORA-ARCHIVO.md`.

Formato:

```text
## AAAA-MM-DD · título corto
Rama: … · Commits: … (o «sin commit»)
Hecho: …
Decisiones: … (de Isaías; las supuestas, marcadas así)
Pendiente: …
```

---

## 2026-11-19 · Columna «Margen total» en el detalle de pedido
Rama: feat/packaging · Commits: ver `git log` (feat(pedidos))
Hecho: la tabla de líneas de escritorio tiene «Margen total» antes de «Subtotal», con el mismo valor y colores que el pill mobile y «—» sin costo. QA: ord-66 59 % verde; ord-34 100 % y 67 %; ord-10 y ord-11 «—»; sin scroll de página a 800 y 375 px. Angular 179.
Decisiones: de Isaías: agregar la columna en escritorio.
Pendiente: a 1280 px la caja de líneas mide ~570 px y «Subtotal» queda cortado hasta desplazar; título «P. unit.» alineado a la izquierda.

## 2026-11-19 · Cancelar de precios en bloque y tabla del pedido
Rama: feat/packaging · Commits: ver `git log` (fix)
Hecho: «Cancelar» de «Actualizar precios en bloque» no avisaba al padre; ahora cierra (escritorio y mobile). El parpadeo era el reseteo + nueva vista previa de cada clic. Detalle de pedido: la grilla usa `minmax(0, 1fr)` bajo 900 px y la tabla de líneas scrollea dentro de su caja; líneas mobile con wrap. QA OK a 800 px y 375 px. Angular 175.
Decisiones: Isaías pidió arreglarlos.
Pendiente: historial de precios de pedido entregado muestra cambio sin cambio de total.

## 2026-11-19 · Precio fijo persistido y márgenes viejos restantes
Rama: feat/packaging · Commits: ver `git log` (fix(productos))
Hecho: el precio fijo (`suggestedPrice`) no se guardaba en MySQL (sin columna ni mapper): se perdía al reiniciar y «Actualizar precios en bloque» no listaba fijos. Columna nueva `products.suggested_price` (local con ALTER aditivo). `priceForTarget` = precio calculado por la calculadora; la confirmación de «Recalcular precios» lista producto, actual → nuevo; el detalle de pedido muestra «Margen total» por línea; la tarjeta usa la respuesta de guardar. QA: fijo $9.000 persiste tras recargar y entra al bloque; tarjeta 832 % / 100 % sin recargar; ord-66 línea 59 %.
Decisiones: de Isaías: seguir con los márgenes viejos. Supuesta: en el pedido, la pastilla del margen total es verde si ≥ 0 y amarilla si es pérdida.
Pendiente: `db:push:heroku` (`suggested_price`); en producción ningún producto tiene el fijo guardado: hay que marcarlos de nuevo, y hasta entonces «Recalcular precios» los pisa; «Cancelar» de «Actualizar precios en bloque» no cierra y el listado parpadea; historial de precios de un pedido entregado muestra cambio aunque el total no cambió.

## 2026-11-19 · Margen del proceso y margen total
Rama: feat/packaging · Commits: ver `git log` (feat(productos))
Hecho: se reemplazó «Margen real (sin mano de obra)» por dos cifras (§16.1.1 «Márgenes que se muestran»): margen del proceso (precio − MO − insumos − packaging, sobre material+purga+luz+máquina+error; en combo, sobre las piezas), comparado con el objetivo y usado por el aviso de «precio bajo el margen», y margen total (ganancia ÷ costo total). Backend manda `processCost` y `nonProcessPrice`; helpers en `product-margin.util.ts` (front y back). Caja de precio, detalle, tarjetas y barra mobile. QA: taza 100 %/59 %, fija $9.000 832 %/83 %, Remera DTF 189 %/106 %, Árbol 182 %/151 %; el aviso ya no incluye la taza. Jest 562, Angular 174.
Decisiones: de Isaías: el objetivo se compara con el margen del proceso; el margen total es otra cifra. Supuesta: el margen total incluye la mano de obra en el costo.
Pendiente: `priceForTarget` de las alertas sigue con el cálculo viejo; `order-detail` muestra el margen por línea con la fórmula vieja; un producto recién guardado usa el margen viejo hasta recargar la lista; «Actualizar precios en bloque» dice que no hay productos con precio fijo (sin revisar); prod-hx570-11 y prod-hx570-13 tienen precios guardados lejos del calculado.

## 2026-11-19 · Precio calculado sin campo para escribir
Rama: feat/packaging · Commits: ver `git log` (feat(productos))
Hecho: en la caja de precio del producto (y combo), en modo Calculado el precio unitario se muestra como texto, sin input; el campo solo aparece en Fijo (con «Volver al sugerido»). QA OK a 800 px y 375 px en prod-45 y prod-54. Angular 167.
Decisiones: de Isaías: «en precio calculado, sacá el input para poner un precio».
Pendiente: tras Fijo → escribir → «Volver al sugerido», Cancelar pide «Descartar cambios» aunque el valor quedó igual.

## 2026-11-19 · «Calculado» con precio fijo muestra el calculado real
Rama: feat/packaging · Commits: ver `git log` (fix(productos))
Hecho: el preview del formulario de producto usaba el fijo y «Calculado $X» mostraba el fijo; ahora el preview ignora el fijo (`ignoreFixedPrice` en `product-form-pricing.service.ts`). QA: prod-45 fijo $9.000 → «Calculado $ 7.822», combo prod-54 → $ 9.072, reabrir no cambia de modo, Remera estampada DTF abre en Fijo $25.000. Angular 165.
Decisiones: Isaías pidió corregirlo.
Pendiente: parpadeo en $0 al abrir la edición; la lista de productos no siempre deja ver si es Fijo o Calculado.

## 2026-11-19 · Precio fijo = precio final en todos los productos
Rama: feat/packaging · Commits: ver `git log` (feat(precios))
Hecho: con precio fijo, el fijo es la lista final en FDM, resina, estampado y combos: no suma insumos × 2, packaging × 1,25 ni armado; el costo sigue completo. Backend (`cost-calculator.service.ts`) y frontend (`priceWithSupplies`, formulario, líneas de pedido: quitar packaging de una línea con fijo solo baja el costo). En modo Fijo la caja de precio no muestra «Cómo se arma el precio calculado» ni notas de insumos. QA: prod-45 fijo $9.000 exacto (costo $4.911), pedido sin cambio de precio al quitar la caja, combo fijo $10.000 exacto; prod-45 quedó de nuevo en calculado. Jest 559, Angular 163.
Decisiones: de Isaías (§16.1.1): la regla del combo («el fijo es la lista») vale para todos los productos con precio fijo.
Pendiente: los productos con fijo guardados antes siguen con su lista vieja (fijo + insumos) hasta recalcular; el texto «Calculado $…» bajo el precio unitario muestra el fijo en vez del calculado; en el combo, «Suma de piezas» de la tarjeta y del editor no coinciden.

## 2026-11-19 · Packaging (§27)
Rama: feat/packaging · Commits: ver `git log` (feat(packaging))
Hecho: categoría de insumo «Packaging»; campo `packagingSupplies` en producto, ítem de pedido y de presupuesto, y `sumPiecesPackaging` en producto (columnas JSON/bool nuevas, en local agregadas a mano). Sección «Packaging» debajo de «Insumos» en producto, líneas de pedido y presupuesto (selectores separados). Costo = valor; precio = valor × 1,25 sin margen de error, mismo cálculo en backend y frontend (paridad). Combo: packaging propio + tilde «Sumar el packaging de las piezas» (apagado); las piezas entran sin su packaging. Stock al entregar (`packaging-delivery.util.ts`) y refresco de Insumos tras entregar. Detalle de producto con línea «Packaging». QA en local: prod-45 +$1.000 costo / +$1.250 precio, combo prod-54 con y sin tilde, entregas ord-66/ord-67 descuentan cajas, presupuesto qpe-37. Jest 556, Angular 159, builds OK.
Decisiones: de Isaías (§27): × 1,25 sin error, por producto y por línea editable, opcional, stock al entregar, tilde de piezas apagado. Supuestas: combo con precio fijo no suma packaging (como los insumos), en los demás tipos va encima del fijo; combo anidado cuenta solo el packaging propio de cada pieza; sin reversión de stock al cancelar.
Pendiente: venta de mostrador no descuenta packaging (por definir reversión); aviso de margen con packaging (por definir); «productos afectados» de un insumo no cuenta packaging; «Cancelar» en la edición de combo quizá no cierra el modal (sin confirmar); `db:push:heroku` al publicar.

## 2026-11-18 · Deploy de mano de obra opcional
Rama: fix/mano-de-obra-opcional → main · Commits: 03e7e64
Hecho: push a origin main y Heroku v49 (sin cambios de esquema, sin `db:push:heroku`). `/api/health` 200; Netlify sirve los chunks del formulario de producto sin la exigencia de mano de obra.
Decisiones: Isaías pidió publicar.
Pendiente: probar en producción con sesión iniciada guardar un producto 3D sin mano de obra.

## 2026-11-18 · Mano de obra opcional en el producto
Rama: fix/mano-de-obra-opcional · Commits: ver git log (fix(productos)…)
Hecho: el formulario de producto de Impresión 3D (FDM/resina) exigía horas de mano de obra para guardar (`missingFields` en `product-form.component.ts`); se sacó de los obligatorios. El backend ya la aceptaba opcional (`@IsOptional`, `Number(…) || 0`) y Estampado nunca la exigió. Probado en local: «QA sin mano de obra» (prod-53) se guardó con costo $793 y precio $1.586, mano de obra $0. Jest 546, Angular 145, tsc OK.
Decisiones: de Isaías: «La mano de obra no es obligatoria cargarla» (BUSINESS-RULES §3). Supuesta: vacía cuenta como $0.
Pendiente: deploy con OK de Isaías.

## 2026-11-18 · Deploy del módulo Ferias
Rama: feat/ferias → main · Commits: f6dd554
Hecho: push a origin main y Heroku v48; después `db:push:heroku` sin ACCEPT_DATA_LOSS (tabla `fairs`, columna `retail_sales.fair_id`). En producción: `/api/health` OK, `/api/fairs` mapeado y pide login; Netlify sirve el bundle con `/ferias`.
Decisiones: Isaías pidió publicar.
Pendiente: probar Ferias en producción con sesión iniciada (crear, abrir, vender, cerrar).

## 2026-11-17 · Módulo Ferias (v4): página, venta rápida y cierre de caja
Rama: feat/ferias · Commits: ver git log (feat(ferias)…)
Hecho: implementado el diseño v4 del lienzo. Backend: modelo `Fair` (planned/open/closed) y `RetailSale.fairId`, módulo `backend/src/fairs/` (resultados y KPIs del mes, detalle por medio de pago y mejor horario, gastos como egresos categoría `fair`, cierre que solo registra la diferencia de caja, «qué llevar»), `CalendarLinkType.FERIA`, bloqueo de ventas/gastos/anulaciones en feria cerrada. Frontend: `/ferias` (KPIs, tabla, detalle, qué llevar → cola), `/ferias/:id/vender` y `/ferias/:id/cierre` para celular, menú y «Más». Esquema aplicado solo en local. Tester: 6 flujos OK; QA visual «cercano» y sus ajustes aplicados. Jest 546, Angular 145, builds OK.
Decisiones: de Isaías (BUSINESS-RULES §26): las tres pantallas; venta de feria = venta normal canal Feria que entra a Billetera al cobrar; el cierre solo registra gastos y diferencia (el fondo no se mueve); Transf. → Banco; gastos en cualquier momento, Caja por defecto con opción de otra cuenta; feria cerrada no se reabre; llevar = máx(⌈prom×1,2⌉, ⌈prom⌉+1) sobre las últimas 3 del mismo nombre. Supuestas: la diferencia de caja usa la categoría `fair` sin contar como gasto; KPIs excluyen ferias planificadas; «Agregado a la cola» solo se recuerda en memoria.
Pendiente: deploy con `db:push:heroku` (tabla `fairs` y columna `retail_sales.fair_id`); sin UI para editar una feria ni el fondo/gastos; tests de `recordDetail` en Billetera; no se probó diferencia positiva ni vínculo con calendario.

## 2026-11-17 · Skills de proyecto: interrogar-plan y revisar-ui
Rama: fix/barrido-errores · Commits: ver git log (docs(claude): skills…)
Hecho: a partir del artículo de Firecrawl sobre skills, se crearon dos en `.claude/skills/`. `interrogar-plan` (versión propia de «Grill Me»): pregunta de a una antes de implementar y anota lo confirmado en BUSINESS-RULES. `revisar-ui`: auditoría de interfaz con las Web Interface Guidelines de Vercel, adaptadas a Angular y al español. Se instaló sin `npx skills`: copia fija del commit 434b7f9 de vercel-labs/web-interface-guidelines (MIT, revisada) en vez de bajarla en cada uso.
Decisiones: de Isaías, sumar esas dos; el resto del artículo ya lo cubren agentes o skills existentes, o no aplica a Angular.
Pendiente: probar las dos en una sesión nueva.

## 2026-11-17 · Memoria de Claude: reglas por carpeta
Rama: fix/barrido-errores · Commits: ec83afe
Hecho: siguiendo el artículo de Web Reactiva sobre la memoria de Claude Code, se crearon reglas en `.claude/rules/`: `git-y-deploy.md` se carga siempre (git, qué no commitear, deploy, lockfile con npm 10.9.9, comandos), y `frontend.md` / `backend.md` se cargan solo al tocar esas carpetas (`paths`). `docs/CLAUDE.md` quedó solo con la fuente de verdad y el flujo con Cursor; ODELL.md y el CLAUDE.md de la raíz remiten a las reglas. Fuera del repo: `~/.claude/CLAUDE.md` con las preferencias generales de Isaías (español rioplatense, sin reportes parciales), y la memoria automática limpia (sin estado viejo y con lo de Cursor en español).
Decisiones: de Isaías, aplicar las cinco propuestas; no usar `CLAUDE.local.md`.
Pendiente: comprobar en una sesión nueva que las reglas se cargan (con `/memory`); commitear `.claude/rules/` junto con los otros cambios de `.claude/`.

## 2026-11-17 · Deploy del barrido de errores
Rama: fix/barrido-errores → main · Commits: be10655
Hecho: push a origin main y Heroku v47; sin cambios de esquema, sin db:push. Los dos primeros intentos de Heroku fallaron en `npm ci` porque el lockfile lo había regenerado npm 11 local; se rehízo sobre el de 02dbe97 con npm 10.9.9. En producción: `/api/health` solo da status/uptime, headers de helmet presentes, la API pide login; Netlify sirve el bundle nuevo.
Pendiente: revisar las pantallas de producción con sesión iniciada.

## 2026-11-16 · Barrido de errores en toda la app
Rama: fix/barrido-errores · Commits: 23d5fe9, c62f727, 3ebbc49, f21b91b
Hecho: auditoría con agentes (backend, frontend, UI con la skill modern-web-guidance, tester en escritorio y celular) y ~70 correcciones. Backend: tesorería (doble reversión de stock, transferencias, préstamos), entregas validadas antes de mutar y con decimales, presupuesto aceptado sin pedido, fechas y meses en hora de Argentina (`common/utils/ar-date.util.ts`), insumos/impresos/tipos en uso no se borran ni renombran, DTO de PATCH de Ajustes validados, MaxLength según schema, último admin protegido, uploads con lista blanca, `/health` mínimo, helmet, `PATCH /categories/:id`, alertas de margen con el criterio de Productos, fila «Sin área» en el balance. Frontend: E133–E135, 401 cierra sesión, diálogos que confirman antes de descartar, form-modal con rol, foco, Esc y scroll lock, inputs accesibles (aria-invalid/describedby, inputmode, 16 px en celular), pedido cancelado con pagos claro en celular. Tests: jest 529, Angular 130, builds OK; tester re-probó en la app y dio OK.
Decisiones (supuestas, sin preguntar): no se bloqueó editar pedidos entregados/cancelados; Esc en form-modal cierra sin confirmar; tope del calendario 1500 días.
Pendiente: E132 sin reproducir; E136–E138 nuevos; preguntas para Isaías en ESTADO; sin deploy (helmet es dependencia nueva del backend).

## 2026-11-16 · Ideas: exhibidor de tazas 140 × 50 × 50 cm
Rama: sin commit (investigación, agente `ideas`)
Hecho: opciones para una impresora de 25 × 25 × 25 cm. Recomendado: conectores impresos en PETG + estantes de madera o MDF.
Pendiente: falta la API key de Gemini para Nano Banana: sin ella no andan `editor-imagenes` ni las imágenes de `ideas`.

## 2026-11-16 · Cinco agentes de apoyo al negocio
Rama: sin commit (archivos en `~/.claude/agents/`, fuera del repo)
Hecho: agentes `editor-imagenes`, `ideas`, `precios`, `seguimiento` y `tester-online` (sonnet). `tester-online` mira Odell en producción sin crear ni cambiar datos.
Decisiones: Isaías eligió cinco agentes separados; el seguimiento (insumos, competencia, tendencias) va a Google Sheets.
Pendiente: crear la planilla «Odell — Seguimiento» (el conector de Drive no dejó crearla) y poner su ID en `seguimiento.md`.

## 2026-11-16 · Deploy de insumos × 2 + margen de error
Rama: feat/insumo-margen-error → main · Commits: 02dbe97
Hecho: push a origin main y a Heroku (v46); sin cambios de esquema, sin db:push. Netlify sirve el chunk nuevo.
Decisiones: Isaías pidió publicar.
Pendiente: en producción, «Actualizar precios» o «Usar precio calculado» en los productos con insumos para tomar la regla nueva; E135.

## 2026-11-16 · Rediseño de la página v3 (Estampado y merch) del lienzo
Rama: — · Commits: sin commit (solo lienzo de diseño)
Hecho: odell-disenador rehízo los 3 artboards de v3 (V3ModalPedido, V3PedidoDetalle, V3Prendas) con el patrón de la app actual: sidebar, paneles, tablas, badges, chips y segmentado de RdPedidoDetalle. El pedido de merch pasó de modal a página, como el form real (Resumen + Seña). Se mantuvieron las funciones de v3.
Decisiones: supuesta: el código manda sobre el artboard viejo (por eso el pedido ya no es un modal).
Pendiente: confirmar con Isaías la «seña obligatoria 50% desde 20 prendas» de v3, que choca con BUSINESS-RULES §Pagos (la seña no tiene efectos). Matriz de talles, stock de prendas lisas y link de aprobación no existen en el código.

## 2026-11-16 · Prueba en la app de insumos × 2 + margen de error
Rama: feat/insumo-margen-error · Commits: 8276ef1
Hecho: odell-tester probó producto Estampado, precio fijo, presupuesto (línea a medida + insumo suelto), combo y detalle; cuentas iguales a mano (±$1 de redondeo). Corregidos: leyenda «Calculado» del presupuesto con el error del insumo duplicado, renglón «Margen de error» en el combo, textos de error y de «Costo unitario».
Decisiones: el «Precio fijo» del producto sigue siendo el total (ya incluye insumos), como antes.
Pendiente: E135 (ganancia estimada sin concepto). Dato de QA: producto «QA taza ×2» (prod-45) en la base local.

## 2026-11-16 · Insumos a costo × 2 con margen de error
Rama: feat/insumo-margen-error · Commits: e4b836c
Hecho: insumos de producto (Estampado/FDM/Resina), combo y línea a medida: costo = valor + valor × error; precio = valor × 2 + valor × error. Utils espejo front/back, desglose suma el error al renglón «Margen de error», textos «× 2 + margen de error» y hint de Ajustes. Jest 492, Karma 117, builds OK. No se probó en la app.
Decisiones: Isaías 2026-11-16: recargo × 2 (antes × 1,5), error del insumo aparte sin recargo, sin error sobre mano de obra ni alcohol de lavado; aplica a todos los productos con insumos. Ejemplo de la taza sublimada en §16.3 ($8.923).
Pendiente: probar en la app, deploy y recalcular precios guardados.

## 2026-11-15 · Duplicar, insumos del combo, servicio de tercero y avisos de faltantes
Rama: feat/apk-twa → main · Commits: bb92539
Hecho: todo lo de «Duplicar al instante» y «No publicados» más: combo con insumos propios (costo + valor, lista + valor ×1,5; duplicar los copia); servicio de tercero con costo (toma el precio al cargarlo, se edita aparte, puede ir a $0; cuenta en costo total y pérdida, panel/diálogo/backend iguales); resumen rojo «Falta: …» tocable en producto, pedido, presupuesto y venta (E127); concepto obligatorio en líneas manuales; correcciones E128–E131, «0» que quedaba «05», bucle infinito al abrir «Nuevo producto» (getter con arreglo nuevo por ciclo en `[ngModel]`); E124. 4 rondas del tester; Karma 114, jest 491.
Decisiones: Isaías: alcohol de resina sigue como material; combos con insumos propios; servicio de tercero precio libre vs costo; categoría obligatoria con botón deshabilitado y aviso visible; combos sí cuentan en «Bajo margen»; concepto obligatorio en línea manual. Supuesta: copia sin publicar y stock 0.
Pendiente: E132 (estampado sin costo una vez, sin reproducir); Modelado con costo fijo sin probar en esta tanda; el buscador de piezas no se limpia al agregar una.

## 2026-11-15 · Duplicar al instante y filtro «No publicados»
Rama: feat/apk-twa · Commits: sin commit
Hecho: «Duplicar» ya no abre el formulario: crea la copia en el momento (`ProductsService.duplicateProduct`, payload armado desde el producto guardado con los campos del DTO), muestra «Copia creada: …» y lleva al detalle de la copia; guard contra doble clic. Nombre «(copia)», «(copia 2)»… sin repetir; stock 0, sin publicar. Se quitó el modo duplicar del diálogo. En Productos el chip «Internos» pasa a «No publicados» y, con texto en la búsqueda, «Todos» también muestra los no publicados. Probado por el tester en escritorio y mobile: combo, FDM con 1 y 2 filamentos, Estampado con precio fijo, (copia 2), editar la copia; mismo costo y precio que el original.
Decisiones: Isaías pidió que la copia se cree al instante y poder encontrar los no publicados con filtro o búsqueda.
Pendiente: commit y deploy (solo frontend). Sin probar con imagen real ni insumos adicionales. Detalles menores: el contador del chip «Precio fijo» incluye no publicados; en el menú de la tarjeta el primer clic a veces parece no hacer nada.

## 2026-11-15 · Duplicar producto
Rama: feat/apk-twa · Commits: sin commit
Hecho: botón «Duplicar» en la tarjeta del listado, en el detalle (escritorio y «Más acciones» en mobile). Abre el diálogo «Duplicar producto» precargado con todo el original (piezas, insumos, filamentos, estampado, precio fijo, descuento, imágenes y .3mf por la misma URL) y se crea recién con «Crear copia». La copia queda con nombre «X (copia)» / «(copia 2)»…, stock 0 y sin publicar. Solo frontend, usa el POST de creación; helper `buildProductDuplicate` con spec. El payload ya no fuerza `published = true` en combos (editar un combo conserva su valor). Probado por el tester: combo, FDM, Estampado con precio fijo, cancelar, clics repetidos y mobile.
Decisiones: supuestas (Claude): copia sin publicar, stock 0, imágenes compartidas por URL (borrar un producto no borra archivos de Storage).
Pendiente: commit y deploy (solo frontend). Sin probar con un producto con imagen ni con insumos adicionales.

## 2026-11-15 · Panel de precio: cómo se arma el calculado (E124)
Rama: feat/apk-twa · Commits: sin commit
Hecho: en Editar producto (modo Calculado, con insumos, no combos) el panel muestra costo sin insumos ni mano de obra + margen del área, insumos + 50 % y mano de obra sin margen, hasta el precio calculado; «Margen real» con aviso si queda bajo el objetivo por los insumos. Texto del margen de error de Estampado en pedidos: «sobre impresos y plancha (sin insumos)». 88 tests ok.
Decisiones: Isaías eligió aclarar la pantalla; la regla §16.3 (insumos ×1,5) no cambia.
Pendiente: commit y deploy (solo frontend).

## 2026-11-15 · Todos los campos numéricos editables igual (E125)
Rama: feat/apk-twa → main · Commits: 5d96eda
Hecho: directiva `dbKeepTyping` para `<input>` nativos con `[ngModel]` (muestra lo tipeado con foco, el valor final al salir) aplicada en seña, costo/precio de línea, márgenes, Ajustes, carrito y piezas. Precio unitario del producto: se puede vaciar; vacío al salir = precio calculado. Probado en Ganancias y producto; 88 tests ok.
Decisiones: Isaías pidió que todos los inputs funcionen igual, salvo casos particulares (descuento avisa si supera el máximo).
Pendiente: nada de esta tarea; publicado en Netlify (solo frontend, Heroku sin cambios).

## 2026-11-15 · Deploy de E125 y E126
Rama: feat/apk-twa → main · Commits: ce64767
Hecho: push a GitHub main y a Heroku (sin cambios de esquema, sin db:push). Health ok y persistencia sana; Netlify sirve el db-input nuevo.
Decisiones: Isaías pidió deployar.
Pendiente: E124; inputs numéricos nativos; regrabar productos de Estampado con precio fijo.

## 2026-11-15 · Campos numéricos, margen y precio fijo de Estampado (E124–E126)
Rama: feat/apk-twa · Commits: sin commit
Hecho: db-input (type number) ya no corrige el valor mientras se escribe: deja vaciar y pasar por 0, el modelo recibe el valor dentro de mín/máx y al salir del campo se muestra el valor del modelo. Probado en editar producto (medida 0,5 y cantidad vacía); 88 tests ok. E124 anotado: el precio $6.610 cumple §16.1.1 y §16.3 (insumos ×1,5 sin margen del área); el texto «30 % sobre impresos, insumos y plancha» está mal (no incluye insumos).
Decisiones: ninguna; E124 espera que Isaías elija entre aclarar la pantalla o aplicar el margen del área a los insumos.
Pendiente: inputs numéricos nativos fuera de db-input; corregir el texto del margen de error; commit y deploy.
Agregado (grabaciones de Isaías): db-input guarda lo emitido para formularios reactivos (E125). E126: el precio fijo de Estampado perdía los insumos al editar (backend `products.service.ts`); probado en local, 488 tests backend y 88 frontend ok. Requiere deploy de backend.

## 2026-11-15 · Publicación de la APK (TWA)
Rama: feat/apk-twa → main · Commits: d44835e
Hecho: push a main; Netlify sirve assetlinks.json (application/json), manifest e íconos. La API de Digital Asset Links de Google confirma el vínculo com.odell.dashboard + huella de la firma. Heroku sin cambios.
Decisiones: Isaías pidió publicar antes de probar en el teléfono.
Pendiente: probar la APK en un Android real.

## 2026-11-15 · APK de Android (TWA)
Rama: feat/apk-twa · Commits: sin commit
Hecho: APK firmada `com.odell.dashboard` 1.0.0 (versionCode 1) con Bubblewrap; abre https://odell-dashboard-v2.netlify.app a pantalla completa. Frontend: manifest.webmanifest (theme #00aae4, fondo #edf5f9), íconos 192/512/maskable, `.well-known/assetlinks.json` y headers en netlify.toml. Proyecto Android en `android-twa/`. JDK 17, SDK y clave de firma en `~/.odell-android` (fuera del repo).
Decisiones: Isaías eligió TWA en vez de Capacitor. minSdk 24 (lo exige androidbrowserhelper 2.7.4).
Pendiente: publicar en main (sin eso la app muestra barra de navegador); probar en un teléfono; logo de 512 px o más (los íconos se agrandaron desde 480).

## 2026-11-14 · Deploy de main a Heroku
Rama: main · Commits: 623efaf (sin commits nuevos)
Hecho: Heroku pasó de 22bf9bc a 623efaf (v41); solo había cambios de frontend, que Netlify ya publicó. Health ok, persistencia sana.
Decisiones: Isaías pidió deployar solo main; el trabajo sin commitear de insumos y pérdida queda afuera.
Pendiente: cerrar, commitear y deployar insumos mayorista + venta a pérdida (con db:push).

## 2026-11-15 · Menú «···» de la lista de pedidos (E123)
Rama: fix/lista-pedidos-menu · Commits: 86545ad, 65ddaf0
Hecho: el menú «···» de la fila de pedidos (escritorio) es un desplegable en caja con ítems y se abre hacia arriba si no entra abajo; las acciones de la fila expandida dejaron de estar en posición absoluta y ya no pisan la nota. Solo frontend (order-card).
Decisiones: ninguna.
Pendiente: no se probó con una nota larga real (no hay en la base local).

## 2026-11-15 · Descuento propio de producto y combo
Rama: feat/descuento-producto · Commits: ver git log (deploy 2026-11-15)
Hecho: productos y combos pueden tener descuento propio (% 0–99 o monto fijo, nunca los dos; discountPercent/discountAmount en Product). price sigue siendo la lista; venta = lista − descuento vía productSalePrice (front y back), usado en pedidos, presupuestos, mostrador y avisos de precio. Lista del combo = suma de listas de piezas + armado sin margen + insumos ×1,5. Mayorista sobre el precio de venta con mínimo costo + 10 %. UI: lista tachada y etiqueta en tarjeta/detalle, formulario con precio de venta y aviso bajo costo. Fix: «Editar producto» mostraba nada al cargar y apilaba diálogos; ahora dice «Abriendo…» e ignora clics repetidos.
Decisiones: de Isaías: descuento en el producto, combo sobre suma de precios, se acumula con mayorista y descuento general con el mínimo. Supuesta: todos los combos (con o sin descuento) calculan su lista desde la suma de precios de piezas.
Pendiente: db:push:heroku al deployar (campos nuevos). Combos existentes mantienen su precio guardado hasta «Usar precio calculado». getProduct tarda ~1 s al abrir la edición.

## 2026-11-15 · Insumos +50 %, mínimo mayorista y venta a pérdida
Rama: feat/insumos-mayorista-perdida · Commits: ver git log (deploy 2026-11-15)
Hecho: insumos de producto y línea a medida se cobran costo × 1,5 (constante SUPPLY_PRICE_MULTIPLIER por lado). Mayorista con mínimo costo + 10 % sin pasar la lista (WHOLESALE_MIN_MARKUP); precio manual se respeta tal cual. Venta a pérdida (línea bajo costo o ganancia total negativa) pide motivo en pedido, presupuesto y venta de mostrador (loss-sale-dialog, 11 códigos); lossReason/lossReasonNote en Order, Quote y RetailSale; trigger loss_sale en historial. Líneas manuales ya no disparan el aviso de cambio de precio de catálogo.
Decisiones: de Isaías: +50 % fijo en insumos, mínimo mayorista, vender a pérdida con motivo y 10 motivos. Supuestas: mínimo = costo + 10 %; borradores de presupuesto también piden motivo; si el set de líneas en pérdida no cambia, se reusa el motivo sin preguntar.
Pendiente: db:push:heroku en el deploy (campos nuevos). Precios guardados de catálogo no se recalculan solos. 6 errores 500 en consola sin URL, probablemente reinicios de nest --watch (no reproducidos con curl).

## 2026-11-14 · Documento de costos y precios
Rama: fix/errores-tanda-2 · Commits: sin commit
Hecho: docs/PRECIOS-Y-COSTOS.md con el desglose de costo y precio por tipo de producto (FDM, resina, estampado, combo) y de línea (diseño, modelado, insumo, tercero), con mayorista y descuento, relevado del código.
Decisiones: ninguna nueva.
Pendiente: decidir los 8 puntos de «A decidir» del documento (insumos sin margen, mano de obra de piezas en combo, costo congelado vs §17, diseño con cantidad > 1, docs §16.2 y §25.6).

## 2026-11-14 · Regla de contexto compartido
Rama: fix/errores-tanda-2 · Commits: sin commit
Hecho: se crearon `CLAUDE.md` (raíz) con las reglas de lectura, escritura y
traspaso, y `docs/contexto/` con ODELL.md, ESTADO.md y esta bitácora. El
estado que vivía en la memoria privada de Claude pasó a ESTADO.md. También se
instaló el agente global `qa-expert` (VoltAgent), que ya estaba.
Decisiones: solo la conversación principal escribe ESTADO y BITÁCORA; los
agentes devuelven «Para la bitácora».
Pendiente: commitear estos archivos (con OK de Isaías).

## 2026-11-10 → 2026-11-13 · Tandas de errores, costos, persistencia y e2e (resumen)
Rama: fix/errores-tanda-2 → main (233d041)
Hecho: errores E2–E90 corregidos (registro en docs/qa/errores-pendientes.md);
costos con material desde el promedio de Insumos y mano de obra sin margen
(5efc56f); guardados a MySQL en serie con reintento (de3987b); suite e2e de
regresión con Playwright (024e627, 233d041).
Decisiones: «Entregado» entrega todo aunque haya tareas sin terminar; insumo
suelto descuenta stock solo si existe en inventario; adjuntos en pedidos y
presupuestos (máx. 10, se copian al pasar a pedido, no van al PDF).
Pendiente: ver ESTADO.md.

## 2026-11-07 → 2026-11-10 · Rediseños y Producción v2 (resumen)
Hecho: rediseño mobile completo (v26), rediseño de pantallas que faltaban
(9595a54), Producción v2 en 4 fases: cola por impresora, detalle de tarea con
horas y fallas, bobinas y reposición, lector .3mf con purga AMS (54c67cc).
Decisiones: ver ODELL.md «Decisiones confirmadas».
