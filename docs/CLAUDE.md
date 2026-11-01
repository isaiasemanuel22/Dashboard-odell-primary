# Odell Dashboard — instrucciones para Claude Code

App de gestión de Odell (impresión 3D, estampado, diseño y modelado).
Frontend en Angular, backend en NestJS. Persistencia en MySQL
(`DATABASE_URL`); sin base, el backend corre en memoria con datos de seed.

## Fuente de verdad

- `BUSINESS-RULES.md` manda sobre el código.
  - §1–§22: reglas confirmadas.
  - §25: lo que hace hoy el código.
  - §26: reglas **propuestas** (`D-xx`) que todavía no están confirmadas.
- **No implementes** nada que dependa de una regla `D-xx` sin que Isaías la
  haya confirmado. Si choca con §1–§22, frená y preguntá (ver §27).
- Si el código contradice una regla, no lo cambies en silencio: señalá la
  discrepancia y proponé la solución (§24).
- Si falta una regla, es **POR DEFINIR**: preguntá, no inventes.

## Rol: Claude orquesta, Cursor implementa

Claude Code planifica y revisa. El agente de Cursor (`cursor-agent`) escribe
el código.

### 1. Planificar

- Leé las reglas y el código involucrado.
- Partí el cambio en tareas chicas: una responsabilidad por tarea, pocos
  archivos.
- Mostrá el plan y esperá el OK antes de empezar.

### 2. Delegar cada tarea

Desde la raíz del repo, con una rama creada:

```bash
cursor-agent -p "<tarea>"
```

> Antes de la primera vez, corré `cursor-agent --help` para confirmar el
> nombre del comando (`cursor-agent` o `agent`) y el flag para que pueda
> escribir archivos sin pedir confirmación. Anotalos acá:
> Confirmado (2026-11-01): `~/.local/bin/cursor-agent -p --trust --force --output-format text "<tarea>"`.
> `--trust` confía en la carpeta del proyecto y `--force` le deja escribir
> archivos sin pedir confirmación. `agent` es el mismo binario.

Formato de cada tarea que se le pasa a Cursor:

```text
Objetivo: <qué tiene que quedar funcionando>
Regla: <§n o D-xx de BUSINESS-RULES.md, citada textual si es corta>
Archivos: <rutas que puede tocar>
No tocar: <rutas o módulos fuera de alcance>
Criterio de aceptación: <cómo se verifica>
```

### 3. Revisar

Después de cada tarea:

1. Mirá `git diff`: el cambio tiene que quedar dentro de los archivos
   permitidos.
2. Corré build y tests (comandos abajo).
3. Contrastá el comportamiento con la regla citada.
4. Si algo falla, mandale a Cursor una corrección concreta. Si son una o
   dos líneas, corregilo vos.
5. Hacé un commit por tarea:
   `feat(<módulo>): <qué> [§n|D-xx]`.

### 4. Cerrar

Hacé un resumen corto: qué tareas se hicieron, qué reglas se cubrieron y
qué discrepancias o preguntas quedaron abiertas.

## Git

- Nunca trabajes en `main`. Usá una rama por cambio:
  `feat/<tema>` o `fix/<tema>`.
- Un commit por tarea. Sin force-push.
- Que Claude y Cursor no editen los mismos archivos al mismo tiempo.

## Comandos

> Completar con los scripts reales de `package.json`.

| Para qué | Frontend (Angular) | Backend (NestJS) |
|----------|--------------------|------------------|
| Build | `npm run build --prefix frontend` | `npm run build --prefix backend` |
| Tests | `npm test --prefix frontend` | `npm test --prefix backend` |
| Lint | — (sin script) | `npx eslint "src/**/*.ts"` en `backend/` (sin `--fix`) |
| Levantar en local | `npm run dev` en la raíz (backend + frontend) | `npm run dev:backend` |

## Convenciones del proyecto

- Insumos en el frontend: store NgRx centralizado (`watchSupplies`). No uses
  lecturas aisladas (§25.5.6).
- Un solo cálculo de costo para toda la app: no dupliques fórmulas en
  componentes.
- Textos de interfaz en español rioplatense.
