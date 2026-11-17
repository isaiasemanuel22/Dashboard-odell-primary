---
name: interrogar-plan
description: Usar antes de implementar una función nueva, un cambio de regla o un rediseño de Odell, cuando Isaías pide «preguntame», «interrogame», «repasemos el plan», «qué falta definir» o cuando el pedido toca algo marcado POR DEFINIR. Le hace preguntas de a una hasta que no quedan dudas y anota cada decisión en BUSINESS-RULES.md.
---

# Interrogar el plan

Objetivo: llegar a un plan sin huecos antes de escribir código. Las preguntas
son para Isaías, en español rioplatense.

## Antes de preguntar

1. Leé el pedido y la sección de `docs/BUSINESS-RULES.md` del tema (buscala con
   Grep por el título; no leas el archivo entero).
2. Mirá «Por definir» en `docs/contexto/ESTADO.md`: si el pedido toca alguno,
   entra en la lista.
3. Armá en silencio la lista de dudas: qué pasa en cada estado, casos borde
   (vacío, cero, cancelado, entregado, sin stock), permisos, qué ve en celular
   y en escritorio, qué pasa con los datos que ya existen.
4. Sacá de la lista todo lo que responde el código o una regla confirmada
   (§1–§22). Eso no se pregunta: se busca.

## Preguntar

- **Una pregunta por mensaje**, la que más cambia el plan primero.
- Cada pregunta trae opciones concretas (2–4) y tu recomendación primero, con
  el motivo en una línea. Si hay regla o código relacionado, citá el § o el
  archivo.
- Si la respuesta abre otra duda, seguí por esa rama antes de cambiar de tema.
- No preguntes lo que no cambia la implementación.
- Cortá cuando no queden dudas que cambien el plan, o si Isaías dice «listo» /
  «seguí»: lo que quede abierto se marca como supuesto.

## Anotar

- Cada decisión confirmada va a `docs/BUSINESS-RULES.md`, en la sección del
  tema, con la fecha (`2026-11-17`). Si cierra un «Por definir» de
  `ESTADO.md`, sacalo de ahí.
- Lo que Isaías no decidió y se asume: marcalo «supuesto» en el plan, nunca en
  BUSINESS-RULES.
- No implementes nada que dependa de una regla `D-xx` sin confirmar (§26).

## Cerrar

Devolvé un resumen corto:

```text
Plan: qué se va a hacer, en pasos.
Decidido hoy: decisión → § donde quedó anotada.
Supuestos: lo que se asume sin confirmar.
Sigue abierto: lo que no frena el plan pero hay que definir.
```

## Ejemplo

Pedido: «Quiero poder cancelar un pedido entregado».

1. Grep `## 13. Estados del pedido` y `## 15. Entregas`; en ESTADO.md figura
   «¿Se puede cancelar un pedido ENTREGADO, y qué pasa con el stock ya
   descontado?».
2. Primera pregunta: «Si cancelás un pedido entregado, ¿el stock que se
   descontó vuelve? (a) Sí, todo — recomendado: la mercadería vuelve al local;
   (b) No, queda descontado; (c) Se elige al cancelar.»
3. Según la respuesta, sigue: ¿qué pasa con los pagos cobrados?, ¿lo puede
   hacer cualquier usuario o solo admin (§22)?
4. Al cerrar: la decisión va a §13 con fecha y se borra el ítem de ESTADO.
