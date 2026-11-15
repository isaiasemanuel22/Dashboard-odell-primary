# Odell — contexto compartido

Estas reglas valen para toda sesión de Claude y para todo agente que trabaje
en este repo. Sirven para que cualquiera entienda de qué va el proyecto sin
releer conversaciones viejas, y para que la sesión siguiente siga el hilo.

Estado actual del proyecto (se carga solo):

@docs/contexto/ESTADO.md

## Los tres archivos

| Archivo | Qué tiene | Cómo cambia |
|---------|-----------|-------------|
| `docs/contexto/ODELL.md` | Qué es Odell, stack, dónde está cada cosa, comandos, entornos, convenciones | Solo cuando cambia algo estructural |
| `docs/contexto/ESTADO.md` | Producción, ramas, trabajo en curso, pendientes, por definir | Se **reescribe**; máximo ~60 líneas |
| `docs/contexto/BITACORA.md` | Una entrada por tarea cerrada: qué se hizo, decisiones, pendientes | Solo se **agrega arriba**; nunca se editan entradas viejas |

Fuera de estos tres: reglas de negocio en `docs/BUSINESS-RULES.md` (manda
sobre el código), forma de trabajo en `docs/CLAUDE.md`, errores reportados en
`docs/qa/errores-pendientes.md`.

## Leer

- **Sesión nueva:** `ESTADO.md` ya está cargado arriba. Si el pedido retoma
  algo, leé las primeras entradas de `BITACORA.md` (no el archivo entero).
- **Agentes:** antes de una tarea no trivial, leé `docs/contexto/ODELL.md`.
  De `BUSINESS-RULES.md` leé solo la sección del tema (buscala con Grep).
- Para saber en qué está el proyecto, usá estos archivos; no reconstruyas el
  estado con `git log` largo ni releyendo historial.
- Si algo de estos archivos no coincide con el código o con git, manda el
  código/git: avisalo para que se corrija.

## Escribir

- **Solo la conversación principal** escribe `ESTADO.md` y `BITACORA.md`.
  Los agentes no los tocan (así no se pisan agentes ni sesiones en paralelo):
  devuelven sus líneas en «Para la bitácora» y la principal las pasa.
- Al **cerrar cada tarea** (antes del resumen final): una entrada nueva arriba
  de todo en `BITACORA.md` y, si cambió algo, reescribir la parte afectada de
  `ESTADO.md` (lo viejo se borra; queda en la bitácora y en git).
- Cambia `ESTADO.md` cuando hay deploy, rama nueva o unida, pendiente nuevo o
  cerrado, o una decisión que afecta el trabajo que sigue.
- Decisiones de negocio confirmadas por Isaías → `BUSINESS-RULES.md`.
  Errores que reporta → `docs/qa/errores-pendientes.md`.
- Nunca secretos (claves, códigos, tokens, contraseñas) en estos archivos.
- Fechas siempre absolutas (`2026-11-14`), nunca «ayer» o «la semana pasada».

## Traspasar (pedido de la principal a un agente)

```text
Contexto: leé docs/contexto/ODELL.md (secciones: …). Regla: §n de BUSINESS-RULES.md.
Objetivo: qué tiene que quedar funcionando o qué hay que averiguar.
Ya decidido: decisiones de Isaías que el agente no debe reabrir.
Archivos: qué puede tocar. No tocar: qué queda fuera.
Criterio de aceptación: cómo se verifica.
Devolver: el formato de abajo.
```

## Devolver (respuesta de un agente a la principal)

```text
Hecho: qué se hizo o qué se encontró (corto).
Archivos: rutas tocadas o relevantes.
Supuestos: lo que el agente decidió solo o asumió.
Pendiente / dudas: lo que no se pudo hacer o hay que preguntarle a Isaías.
Para la bitácora: 1–3 líneas listas para pegar.
```

Los agentes con formato de salida propio (JSON, ✅/❌) lo mantienen y suman
al final «Para la bitácora».
