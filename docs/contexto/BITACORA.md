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
