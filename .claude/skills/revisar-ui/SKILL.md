---
name: revisar-ui
description: Usar cuando Isaías pide revisar la interfaz, la accesibilidad o la UX del código del frontend de Odell («revisá la UI», «chequeá accesibilidad», «auditá esta pantalla», «revisá el formulario de…»). Compara plantillas y estilos de Angular contra las Web Interface Guidelines de Vercel y devuelve hallazgos archivo:línea. No edita código ni compara contra el diseño (eso es odell-qa-visual).
argument-hint: <archivo, carpeta o patrón de frontend/src/app>
---

# Revisar UI

Revisa el código de interfaz (`.html`, `.scss`, `.ts` de componentes) contra
`guias-vercel.md`, que está en esta carpeta.

## Origen de las guías

`guias-vercel.md` es una copia fija de `command.md` del repo
vercel-labs/web-interface-guidelines, commit
`434b7f91364665f2f733b310ec54809bf8f37937` (2026-11-17, licencia MIT en
`LICENSE-vercel`). No la bajes de nuevo en cada uso. Para actualizarla, se baja
el commit nuevo, se revisa el diff y se reemplaza.

## Pasos

1. Si no te dieron archivos, preguntá qué pantalla o componente revisar.
   Componentes compartidos: `frontend/src/app/components/` (`db-*` escritorio,
   `mobile-*` celular); pantallas: `frontend/src/app/pages/`.
2. Leé `guias-vercel.md` y los archivos pedidos (plantilla, estilos y el `.ts`
   del componente).
3. Compará contra todas las reglas, traducidas a Angular (tabla abajo).
4. Respondé en el formato de salida.

## Traducción a Angular y a Odell

| Guía (React/Next/Tailwind) | En Odell |
|---|---|
| `onKeyDown` / `onClick` | `(keydown)` / `(click)` |
| `htmlFor` | `for` / `[attr.for]` |
| `<Link>` | `<a routerLink>` |
| `focus-visible:ring-*` | `:focus-visible` en el `.scss` |
| `spellCheck={false}` | `spellcheck="false"` |
| URL sync con nuqs | `queryParams` del router |
| router guard de cambios sin guardar | `CanDeactivate` |

No apliquen (saltealas): **Hydration Safety** (no hay SSR), virtualización con
`virtua`, `priority` de Next en imágenes.

**Content & Copy** está pensado para inglés. En Odell los textos van en
español rioplatense, con mayúscula solo al principio (no Title Case). Sí valen:
voz activa, números en cifras, botones con verbo concreto («Guardar
producto», no «Continuar»), errores que dicen cómo seguir, `…` en lugar de
`...`.

Reglas del proyecto que también se chequean (ver `.claude/rules/frontend.md`):
campos numéricos con `db-input` o `dbKeepTyping`; nada de `font: … inherit;`.

Si un hallazgo choca con algo de «Por definir» en `docs/contexto/ESTADO.md`
(por ejemplo, aviso al salir con cambios sin guardar), marcalo `[por definir]`
en vez de error.

## Formato de salida

En español, agrupado por archivo, una línea por hallazgo, sin introducción:

```text
## frontend/src/app/components/db-button/db-button.component.html

frontend/src/app/components/db-button/db-button.component.html:12 - botón solo ícono sin aria-label
frontend/src/app/components/db-button/db-button.component.scss:30 - outline: none sin :focus-visible

## frontend/src/app/pages/sales/sale-form/sale-form.component.html

✓ sin hallazgos
```

Al final, una línea con el total y los tres hallazgos que más afectan al uso
en el celular.
