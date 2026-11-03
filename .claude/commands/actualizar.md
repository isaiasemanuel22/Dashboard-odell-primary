---
description: Orquesta una actualización con subagentes
---

Objetivo: $ARGUMENTS

Flujo:
1. Llamá al subagente `explorador`. Pasale solo el objetivo.
2. Con su JSON, llamá al subagente `planificador`.
3. Si el plan es claro, llamá al subagente `editor-mecanico` con el plan completo. Si el plan deja
   decisiones abiertas o el editor-mecanico deja casos sin aplicar, preguntame antes de seguir.
4. Después, llamá al subagente `verificador`.
5. Devolveme solo:
   - qué cambió
   - qué pasó en tests
   - qué falta
