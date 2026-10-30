---
name: odell-correcciones-uno-por-uno
description: >-
  Corrige hallazgos de QA de Odell de a uno, del más bajo al más crítico,
  preguntando antes de cada arreglo. Usar cuando pidan ir uno por uno,
  seguir con los bugs, resolver la ronda de QA hallazgo a hallazgo, o
  cuando digan que hay que preguntar antes de corregir.
---

# Correcciones Odell — uno por uno

En el chat principal: **desglosar → preguntar → esperar OK → recién entonces
implementar** (vos o un subagente). Nunca arrancar el siguiente hallazgo
sin aprobación explícita del actual.

## Orden

1. Leer el informe de QA (adjunto o `.cursor/qa/informe.md`).
2. Listar solo lo abierto, de **más bajo a más crítico** (obs./bajo → medio → alto → crítico).
3. Empezar por el primero de esa lista.

## Por cada hallazgo

1. **Desglose breve** (2–6 líneas): qué pasa, causa probable, alcance del fix.
2. **Preguntar** si se hace, con opciones si hay trade-off (ej. solo mensaje vs clamp).
3. **Parar.** No editar código ni lanzar `odell-correcciones` hasta que el
   usuario diga que sí (o elija la opción).
4. Tras el OK: implementar (o lanzar el subagente `odell-correcciones` con
   alcance **solo** ese hallazgo).
5. Resumir el resultado y **preguntar** si seguimos con el siguiente.

## Prohibido

- Encadenar Q4 → Q3 → Q2 sin preguntar entre medio.
- “Ya que estoy” tocar el siguiente bug.
- Tratar “seguimos” / “dale” genérico como OK de **todos** los pendientes:
  vale solo para el hallazgo que acabás de desglosar (o el que el usuario nombre).

## Contexto de negocio

Si al cerrar un hallazgo queda una **regla de negocio** confirmada (no un
parche técnico), sumarla en `docs/BUSINESS-RULES.md` (§5 / §16 / §25 según
corresponda) en el mismo paso o justo después, y mencionarlo al usuario.

## Relación con otras skills

- Ronda completa automática sin preguntar → `odell-correcciones` (subagente).
- Este skill manda cuando el usuario pide **uno por uno** o **preguntar antes**.
