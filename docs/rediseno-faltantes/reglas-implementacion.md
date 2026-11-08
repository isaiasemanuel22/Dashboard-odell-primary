# Rediseño de las piezas que faltaban: reglas de implementación

Valen para todos los briefs de `docs/rediseno-faltantes/briefs/`. Cada brief
solo agrega lo específico.

## Referencias

- Artboards aprobados: `docs/rediseno-faltantes/artboards/*.dc.html`.
  - `Rd*`: desktop.
  - `MobRd*`: mobile, 390 px.
  - `ModalPedido`, `ModalPresupuesto`, `V1ModalCliente` y `AjustesUsuarios`:
    diseños ya aprobados de «Versión actual».
- Los artboards son HTML estático. Tomá de ahí estructura, jerarquía, textos,
  espaciados y radios.
  - Ignorá `<x-dc>`, `<helmet>`, `support.js` y el bloque `<script type="text/x-dc">`.
  - Los datos son de ejemplo: en la app van los reales.
  - Las clases del artboard (`.modal .mh .mf .field .seg .achip .btn-p`…) son
    del lienzo, no de la app.
- `RdPatrones.dc.html` tiene los tres patrones base:
  - §1: modal de formulario.
  - §2: confirmación.
  - §3: panel de filtros de desktop.
- Mobile: seguí también `docs/mobile/reglas-implementacion.md` (piezas
  `db-mobile-*`, clases `m-*`, `pushOverlay`, etc.).

## Cómo traducir el artboard a la app

- Usá los componentes que ya existen:
  - `db-button`, `db-input`, `db-select`, `db-form`, `db-form-grid`,
    `db-status-badge`, `db-service-badge`, `db-data-table`;
  - `app-form-dialog-shell` y `FormDialogService` para modales;
  - `db-mobile-*` para mobile.
  - Si un patrón se repite en 2 piezas o más, extraelo a un componente
    compartido.
- Colores, radios, sombras y espaciados salen de los tokens de
  `frontend/src/styles/_variables.scss` (`$color-*`, etc.) o de
  `_mobile.scss` en mobile.
  - Nada de hex sueltos nuevos.
  - En los archivos que tocás, reemplazá los hex existentes por tokens cuando
    exista uno equivalente.
- Tipografía: la de la app (Inter), no Ubuntu.
- Íconos: SVG inline de trazo, como en los artboards. Nada de emoji (hoy hay
  🔍, ⚑ y 🕐 en la Cola: reemplazalos).
- Modales: encabezado con título y subtítulo, cruz a la derecha y pie con
  Cancelar (secundario) y la acción principal con verbo, como RdPatrones §1.
  - Anchos: 480 chico, 560 medio, 760 grande y 960 con dos columnas.
  - El botón rojo (variante peligro) va solo cuando la acción borra o no se
    puede deshacer.
- En mobile, los modales de `FormDialogService` ya salen como hoja inferior.
  Ajustá su contenido para que quede como el `MobRd*` correspondiente; no
  hagas un componente aparte si no hace falta.

## Lo que no se cambia

- Funciones, validaciones, servicios y reglas de negocio: se reusa todo lo
  existente.
  - No se agregan ni se quitan acciones.
  - Si el artboard muestra algo que el código no tiene, no lo inventes:
    anotalo en la respuesta.
- Pantallas fuera del brief.
- Desktop de pantallas que ya estaban rediseñadas.
- Textos en español rioplatense. Accesibilidad: botones reales, `aria-label`
  en botones de ícono, toques de 44 px o más en mobile, y `role="switch"` con
  `aria-checked` en interruptores.

## CSS

- Nunca `font: <peso> <tamaño> inherit;`. Usá `font-family: inherit;` y
  declaraciones separadas.
- Cuidado con la especificidad de reglas globales como `.modal input:not(...)`.

## Antes de terminar

- `npm run build --prefix frontend` sin errores.
- `grep -rn "font: [0-9][^;]*inherit;" frontend/src` sin resultados.
- `cd frontend && CHROME_BIN=/usr/bin/google-chrome npx ng test --watch=false --browsers=ChromeHeadless`
  en verde. Si un test cambia por el markup nuevo, actualizalo sin perder lo
  que verifica.
- No corras `git commit`, `git add`, `git stash` ni nada que modifique git.
- No levantes el dev server ni hagas revisión visual.
- Respondé con:
  - archivos tocados;
  - qué componentes compartidos creaste o reusaste;
  - diferencias con el artboard que no pudiste resolver y por qué.
