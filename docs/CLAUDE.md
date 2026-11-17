# Odell Dashboard — instrucciones para Claude Code

App de gestión de Odell (impresión 3D, estampado, diseño y modelado).
Frontend en Angular, backend en NestJS. Persistencia en MySQL
(`DATABASE_URL`); sin base, el backend corre en memoria con datos de seed.

Git, deploy, comandos y convenciones de frontend y backend: `.claude/rules/`.

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
~/.local/bin/cursor-agent -p --trust --force --output-format text "<tarea>"
```

- Está en `~/.local/bin`, no en el PATH: usá la ruta completa.
- `--trust` confía en la carpeta del proyecto y `--force` le deja escribir
  archivos sin pedir confirmación.
- Necesita el permiso `Bash(~/.local/bin/cursor-agent:*)` en
  `.claude/settings.local.json`.
- Decile explícitamente que no haga `git commit`, `git add` ni `git stash`.
- Si el modo automático lo bloquea, usá el agente `odell-implementador`.

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
2. Corré build y tests (comandos en `.claude/rules/git-y-deploy.md`).
3. Contrastá el comportamiento con la regla citada.
4. Si algo falla, mandale a Cursor una corrección concreta. Si son una o
   dos líneas, corregilo vos.
5. Hacé un commit por tarea:
   `feat(<módulo>): <qué> [§n|D-xx]`.

### 4. Cerrar

Hacé un resumen corto: qué tareas se hicieron, qué reglas se cubrieron y
qué discrepancias o preguntas quedaron abiertas.
