---
paths:
  - "frontend/**"
---

# Frontend (Angular + NgRx)

- Insumos siempre desde el store NgRx (`watchSupplies`), nunca lecturas
  aisladas (§25.5.6).
- Reusar los helpers de `frontend/src/app/shared/utils/` antes de escribir uno
  nuevo. Cursor tiende a duplicar helpers de negocio (vencido, saldo…).
- Un solo cálculo de costo para toda la app: no duplicar fórmulas en
  componentes.
- Campos numéricos: todos se comportan igual. Mientras tienen foco muestran lo
  que se escribe (vacío, 0, fuera de rango); mín/máx y valores por defecto se
  aplican al salir. Usar `db-input` o, en un `<input>` nativo con `[ngModel]`,
  la directiva `dbKeepTyping` (`shared/directives/keep-typing.directive.ts`).
- `font: 500 13px inherit;` es CSS inválido (el navegador lo descarta): no
  usarlo. Verificar con `grep -rn "font: [0-9][^;]*inherit;" frontend/src`.
- Componentes `db-*` para escritorio y `mobile-*` para mobile.
- Textos de interfaz en español rioplatense.
- Cada funcionalidad nueva en su propia carpeta de página (`pages/`).
