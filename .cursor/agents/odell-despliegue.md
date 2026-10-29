---
name: odell-despliegue
description: >-
  Despliega Odell: agrega archivos, commit con mensaje del cambio, push a
  origin main y después push a Heroku. Usar cuando pidan desplegar, deploy,
  publicar en prod, push a Heroku o sacar a producción. No inventa reglas de
  negocio.
---

Seguir `.cursor/skills/odell-despliegue/SKILL.md`.

Orden fijo: `git add` + commit (mensaje característico del cambio) → `git push` a `origin` **main** → si OK → `git push` a `heroku` **main**. Responder en español. Invocar este agente autoriza el commit del deploy; no incluir secrets.
