---
name: odell-correcciones
description: >-
  Repara en el código los fallos que detecta el agente odell-qa. Usar cuando
  pidan corregir, arreglar o reparar hallazgos de QA. Lee el informe, cambia
  el código y le pide a odell-qa que vuelva a probar.
---

Reparar solo lo que el agente `odell-qa` dejó por escrito. No recorrer la app por cuenta propia para buscar otros problemas.

## Cómo hablar con QA

1. Leer `.cursor/qa/informe.md`.
2. Si no existe, lanzar el subagente `odell-qa` y, cuando termine, leer ese archivo. Si QA no pudo escribirlo, guardar su informe ahí antes de seguir.
3. Después de cada ronda de cambios, escribir `.cursor/qa/correcciones.md` y lanzar de nuevo `odell-qa` con la lista de pantallas a reprobar. Una sola reprobación. No lanzar una tercera.

## Qué reparar

- **Fallo:** repararlo si la causa está en el código de la app.
- **Confuso:** repararlo solo si un cambio chico evita que el usuario tenga que adivinar, sin cambiar una regla de negocio.
- **Negocio:** repararlo solo cuando las secciones 1 a 23 de `docs/BUSINESS-RULES.md` dicen qué debe pasar y el código hace otra cosa. Si el informe dice **POR DEFINIR**, no inventar la regla y no cambiar el código. Anotarlo en **Consultas** para que, al terminar, el usuario decida si se resuelve ahora o queda para después.

No reparar un hallazgo causado por el entorno (API caída, backend reiniciando, herramienta del navegador). Anotarlo como omitido.

## Cómo reparar

- Leer el código que ya existe y reutilizarlo. El cambio tiene que ser el más chico que quite la causa.
- No hacer commits. No tocar secretos ni configuración de producción.
- No borrar ni editar registros que no lleven el prefijo `QA-`.
- Antes de una prueba runtime del backend, desde `backend/` ejecutar `npm run kill:dev` y confirmar que el puerto 3000 quedó libre.

## Informe de correcciones

Guardar esto en `.cursor/qa/correcciones.md`:

```markdown
# Correcciones Odell

## Resumen
- Reparados:
- Omitidos:
- Siguen después de reprobar:
- Consultas:

## Por hallazgo
### Título del hallazgo de QA
- Decisión: Reparado | Omitido | Consulta
- Por qué:
- Archivos:
- Reprobado: sí o no, y qué dijo QA

## Consultas
Una por cada desvío de negocio que el documento deja **POR DEFINIR**. No proponer la regla.

### Título
- Pantalla:
- Qué hace hoy el código:
- Qué no está definido:
- Sección:
```
