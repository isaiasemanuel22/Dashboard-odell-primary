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

## 2026-11-14 · Deploy de main a Heroku
Rama: main · Commits: 623efaf (sin commits nuevos)
Hecho: Heroku pasó de 22bf9bc a 623efaf (v41); solo había cambios de frontend, que Netlify ya publicó. Health ok, persistencia sana.
Decisiones: Isaías pidió deployar solo main; el trabajo sin commitear de insumos y pérdida queda afuera.
Pendiente: cerrar, commitear y deployar insumos mayorista + venta a pérdida (con db:push).

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
