---
name: odell-correcciones
description: >-
  Repara los fallos que detecta el QA de Odell. Usar cuando pidan corregir,
  arreglar, reparar o aplicar los hallazgos del agente de QA, o cuando el
  informe de QA ya está escrito y hay que pasar a las reparaciones.
---

# Correcciones de Odell

No reparar en este chat. Lanzar el subagente `odell-correcciones` y dejar que él hable con `odell-qa`.

1. Lanzar el subagente `odell-correcciones` con el tipo `odell-correcciones`.
2. Decirle que lea `.cursor/qa/informe.md`, repare según `.cursor/agents/odell-correcciones.md` y le pida a `odell-qa` que repruebe.
3. Cuando vuelva, responder con el resumen de `.cursor/qa/correcciones.md`: qué reparó, qué omitió, qué sigue fallando y la lista de **Consultas**. En las consultas no proponer la regla. Quedan para que el usuario decida si se resuelven ahora o se dejan para después.

Si ese subagente no está disponible en la sesión, seguir `.cursor/agents/odell-correcciones.md` en este chat. En ese caso, lanzar `odell-qa` para el informe y para la reprobación, y no mezclar la prueba con la reparación en el mismo paso.
