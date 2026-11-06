Leé primero docs/mobile/reglas-implementacion.md (en especial «No duplicar: modularizar») y docs/mobile/familias.md (parte 2, «Hallazgo transversal: barra fija» y la familia B). Seguilos al pie de la letra.

Tarea: extracción 1 · barra fija de acciones mobile (`db-mobile-dock`).

1. Creá `frontend/src/app/components/mobile-dock/` (standalone, OnPush): barra fija abajo, fondo blanco, borde superior, padding 12px 16px 20px + `env(safe-area-inset-bottom)`, botones de 52px y radio 14 con gap 10px; el secundario ocupa 1 parte (o 120px fijos si se pide `secondaryFixed`), el primario el resto. API:
   - `actions` input: `{ id: string; label: string; kind: 'primary' | 'secondary'; disabled?: boolean; loading?: boolean; ariaLabel?: string }[]`, y output `action` con el `id`;
   - además `<ng-content>` para casos especiales (ej. una línea de ayuda o «Falta: …» debajo de los botones): slot `[dockHint]`.
   - Que ponga el padding inferior necesario en el contenido de la página: exponé una clase utilitaria `m-has-dock` en `_mobile-kit.scss` o un mecanismo equivalente, y usalo en vez de los paddings sueltos de cada página.
   - Exportalo desde el barrel `components/general-components/public-api.ts` pero importalo directo desde su archivo donde se use (no por el barrel) para no inflar la carga inicial.
2. Reemplazá las variantes actuales por el componente, con el mismo resultado visual y el mismo comportamiento (mismos métodos, mismas condiciones de visibilidad/disabled, mismos textos):
   - order-detail (`od-m__dock`), quote-detail (`qd-m__dock`), customer-detail (`cd-m__dock`), product-detail (`pd-m__dock`), sale-form (`sale-m__dock`), order-form (`order-form__dock-submit`, incluido el «Falta: …»/nota debajo en el slot), y las subpantallas de ajustes (`st-m__dock` en `_settings-mobile.scss` y sus templates).
   - Borrá el SCSS y markup que queden sin uso.
3. Actualizá en docs/mobile/familias.md las secciones «Si cambiás X, tocá» de las familias B, C y G para que apunten a `components/mobile-dock`.

Criterio: el de reglas-implementacion.md, y además `grep -rn "m__dock\|__dock-submit" frontend/src` sin resultados. Respondé con archivos tocados, líneas eliminadas aproximadas y cualquier pantalla donde el resultado no haya podido quedar idéntico.
