---
name: angular-best-practices
description: Buenas prácticas de Angular moderno (v17+ standalone, signals, control flow). Usar SIEMPRE que se cree, modifique, revise o refactorice código Angular (componentes, servicios, rutas, formularios, templates, estilos) para decidir cuándo modularizar, cuándo crear o generalizar un componente, dónde ubicar la lógica y cómo mantener el código legible.
---

# Angular: buenas prácticas, arquitectura y criterio de refactor

Actuás como un **desarrollador senior de Angular** que cuida la arquitectura a largo plazo. Tu objetivo no es solo que el código funcione, sino que sea **fácil de leer, cambiar, testear y escalar**. Antes de escribir código, pensá dónde debe vivir cada pieza.

> Si el proyecto usa una versión anterior de Angular (NgModules, sin signals), respetá el estilo existente y aplicá estos principios adaptados. **La consistencia con el código del proyecto gana sobre la preferencia personal.** Revisá `package.json` para conocer la versión.

---

## 1. Principios generales (aplican a todo)

| Principio | Qué significa en Angular |
|---|---|
| **SRP** (Responsabilidad única) | Un componente muestra UI; un servicio maneja datos o una regla de negocio; un pipe transforma. Si describís una clase con "y", tiene dos responsabilidades. |
| **OCP** (Abierto/Cerrado) | Extendé comportamiento con inputs, content projection, `ng-template` o estrategias inyectadas, no modificando el componente para cada caso nuevo. |
| **LSP / ISP** | Interfaces chicas y específicas. Un componente no debe recibir un objeto gigante si solo usa 2 campos. |
| **DIP** (Inversión de dependencias) | Dependé de abstracciones (`InjectionToken`, clases abstractas) cuando la implementación puede cambiar (ej: storage, logger, proveedor de pagos). |
| **DRY** | No repitas *conocimiento*. Duplicar 2 líneas parecidas está bien; duplicar una regla de negocio no. |
| **KISS** | La solución más simple que resuelva el problema actual. |
| **YAGNI** | No construyas genéricos, configuraciones ni capas "por si acaso". |
| **SoC** (Separación de responsabilidades) | Presentación ≠ estado ≠ acceso a datos ≠ reglas de negocio. |
| **Single Source of Truth** | Cada dato tiene un único dueño (un store/servicio). Los demás lo leen, no lo copian. |
| **Composición sobre herencia** | Preferí componer componentes, directivas y funciones `inject*()` antes que `extends BaseComponent`. |
| **Ley de Deméter** | Evitá `this.order.customer.address.city` en templates; exponé lo que se necesita. |
| **Fail fast** | Validá entradas temprano, usá early returns, tipá estricto. |
| **Regla del Boy Scout** | Dejá el archivo un poco mejor de lo que lo encontraste, sin desviarte de la tarea. |
| **Principio de menor sorpresa** | Nombres, ubicaciones y patrones predecibles. Otro dev debe encontrar las cosas donde espera. |

---

## 2. Estructura del proyecto (feature-first)

Organizá por **funcionalidad de negocio**, no por tipo de archivo.

```
src/app/
├── core/                 # Singleton, se usa una vez en toda la app
│   ├── auth/             # auth.service, auth.guard, auth.interceptor
│   ├── http/             # interceptors, error handler global
│   ├── layout/           # shell, header, sidebar, footer
│   └── config/           # tokens, environment wrappers
├── shared/               # Reutilizable, SIN lógica de negocio
│   ├── ui/               # componentes genéricos: button, modal, table, card
│   ├── directives/
│   ├── pipes/
│   ├── utils/            # funciones puras
│   └── models/           # tipos verdaderamente transversales
├── features/
│   ├── products/
│   │   ├── data-access/  # products.api.ts, products.store.ts, models
│   │   ├── ui/           # componentes presentacionales del feature
│   │   ├── pages/        # componentes ruteables (smart / containers)
│   │   ├── utils/
│   │   └── products.routes.ts
│   └── orders/
└── app.routes.ts
```

### Reglas de dependencia (obligatorias)
- `features/*` puede importar de `shared/` y `core/`.
- `shared/` **nunca** importa de `features/` ni de `core/` (salvo tipos muy básicos).
- Un feature **no importa internals de otro feature**. Si dos features necesitan lo mismo, se sube a `shared/` (si es UI/genérico) o se crea un `data-access` compartido (si es dominio).
- `core/` no importa de `features/`.
- Usá path aliases (`@core/*`, `@shared/*`, `@features/*`) en `tsconfig.json` en lugar de `../../../`.
- Cada feature se carga con **lazy loading** desde las rutas.

---

## 3. Árbol de decisión: ¿cuándo modularizar / extraer?

Ante cualquier cambio, evaluá estas señales. **Si se cumplen 2 o más, extraé.**

### Extraer un **subcomponente** cuando:
- El template supera ~100–150 líneas o el `.ts` supera ~200–250 líneas.
- Hay un bloque del template con su **propio estado o eventos** (ej: un formulario de filtros dentro de una página).
- Un bloque se repite dentro del mismo template (`@for` con un markup complejo → `<app-product-card>`).
- Podés ponerle un **nombre de negocio claro** al bloque ("resumen del carrito", "fila de pedido").
- Necesitás testear ese bloque de forma aislada.

### Extraer un **servicio** cuando:
- Hay llamadas HTTP o acceso a storage dentro de un componente.
- Dos o más componentes necesitan el mismo estado o la misma regla.
- El componente tiene lógica que no depende del DOM (cálculos, validaciones de negocio, orquestación).

### Extraer una **función pura (utils)** cuando:
- La lógica no necesita inyección de dependencias ni estado (formatear, calcular, mapear, ordenar).
- Es fácilmente testeable con entrada → salida.

### Extraer un **pipe** cuando:
- Una transformación de presentación se usa en templates (formato de precio, estado → etiqueta). Siempre `pure`.

### Extraer una **directiva** cuando:
- Un comportamiento de DOM se repite en distintos elementos (autofocus, click-outside, permisos `*appHasRole`, lazy image).

### Crear un **feature nuevo** cuando:
- Hay una ruta propia, un conjunto de pantallas relacionadas y un dominio de datos propio.

### **NO** extraigas cuando:
- El código se usa una sola vez y es corto y claro.
- La extracción obliga a pasar 8 inputs para algo trivial.
- Solo estás "preparando" para un futuro hipotético (YAGNI).

---

## 4. Componentes: smart vs presentacionales

### Containers / Pages (smart)
- Viven en `features/<x>/pages/`.
- Inyectan servicios/stores, obtienen datos, manejan navegación y efectos.
- Poco markup propio: componen componentes de UI.

### Presentacionales (dumb)
- Viven en `features/<x>/ui/` o `shared/ui/`.
- Solo `input()` y `output()`. **No inyectan servicios de datos** ni el Router.
- Sin efectos secundarios. Mismo input → misma UI.
- Siempre `ChangeDetectionStrategy.OnPush`.

### Plantilla base de componente
```ts
@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [CurrencyPipe],
  templateUrl: './product-card.component.html',
  styleUrl: './product-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductCardComponent {
  readonly product = input.required<Product>();
  readonly compact = input(false);
  readonly addToCart = output<Product>();

  protected readonly hasDiscount = computed(() => this.product().discount > 0);

  protected onAdd(): void {
    this.addToCart.emit(this.product());
  }
}
```

Convenciones:
- `input()`, `output()`, `model()` (signals) en lugar de `@Input/@Output` en proyectos nuevos.
- `inject()` en lugar de inyección por constructor.
- Miembros usados solo por el template → `protected`. Estado → `readonly` signals.
- Un componente por archivo. Selector con prefijo del proyecto (`app-`).

---

## 5. Componentes genéricos: cuándo crearlos, cambiarlos o separarlos

### Regla de tres
1. **Primera vez:** escribilo donde se necesita.
2. **Segunda vez:** tolerá la duplicación, pero anotá la similitud.
3. **Tercera vez:** extraé el componente genérico a `shared/ui/`.

Excepción: elementos base del design system (botón, input, modal, tabla, card, badge, spinner, empty-state) se crean genéricos desde el inicio.

### Antes de generalizar, preguntate
- ¿Los casos comparten **la misma razón para cambiar**? Si cambian por motivos distintos, son componentes distintos aunque se vean parecidos (duplicación accidental, no real).
- ¿Puedo nombrarlo sin referirme a un feature? (`app-data-table` ✅, `app-orders-table-generic` ❌).
- ¿El genérico quedaría libre de lógica de negocio?

### Cómo diseñar un buen componente genérico
- **Content projection (`<ng-content>`)** para contenido libre, con slots nombrados (`select="[card-header]"`).
- **`ng-template` + `ngTemplateOutlet`** cuando el padre debe controlar cómo se renderiza cada ítem (celdas de tabla, opciones de lista).
- **Genéricos de TypeScript** para datos: `DataTableComponent<T>`.
- Inputs pequeños y semánticos (`variant: 'primary' | 'ghost'`, `size: 'sm' | 'md'`), con valores por defecto.
- Outputs con nombres de evento, no de acción interna (`selected`, `closed`, no `handleClick`).
- Para inputs de formulario: implementar **`ControlValueAccessor`** para que funcione con `formControlName`.

### Señales de que un genérico se está corrompiendo → separar o recomponer
- Más de ~3 flags booleanos que alteran la estructura (`showHeader`, `isAdminMode`, `useAltLayout`…).
- `@if` dentro del genérico que pregunta "¿desde qué feature me usan?".
- Inputs que solo usa un consumidor.
- El genérico importa un servicio de un feature.

Soluciones, en orden de preferencia:
1. Pasar la variación por **content projection** o **template**.
2. Dividir en **componentes compuestos** (`<app-card>`, `<app-card-header>`, `<app-card-actions>`).
3. Crear un **wrapper específico del feature** que use el genérico (`OrderTableComponent` envuelve `DataTableComponent`).
4. Si los casos divergieron demasiado, **des-generalizar**: volver a dos componentes específicos es válido.

---

## 6. ¿Dónde va cada lógica?

| Tipo de lógica | Ubicación correcta | Nunca en |
|---|---|---|
| Formato visual simple | Pipe puro | Método llamado desde el template |
| Estado derivado de UI | `computed()` en el componente | Recalculado en el template |
| Estado de UI local (abierto/cerrado, tab activa) | `signal()` en el componente | Servicio global |
| Estado compartido entre componentes | Servicio/store del feature (`providedIn: 'root'` o provisto en la ruta) | Duplicado en cada componente |
| Llamadas HTTP | `*.api.ts` / data service en `data-access/` | Componente |
| Mapeo DTO → modelo de dominio | Data service o función `mapXxx()` en utils | Template o componente |
| Reglas de negocio (precio final, permisos, validación de stock) | Servicio de dominio o funciones puras | Componente presentacional |
| Orquestación de varios servicios para una pantalla | **Facade** o store del feature | Página con 6 servicios inyectados |
| Comportamiento de DOM reutilizable | Directiva | Copiado en varios componentes |
| Autorización de rutas | Guard funcional (`CanActivateFn`) | `ngOnInit` del componente |
| Precarga de datos de una ruta | Resolver o el store al entrar | Cadena de subscribes en el componente |
| Headers, tokens, errores HTTP globales | Interceptor funcional | Cada servicio |
| Constantes / configuración | `const` tipadas o `InjectionToken` | Strings y números mágicos dispersos |

**Regla práctica:** si una línea de lógica no necesita el DOM, probablemente no pertenece al componente.

### Cuándo mover lógica (refactor)
- Un componente inyecta más de 3–4 servicios → crear una **facade**.
- Un `subscribe` dentro de otro `subscribe` → componer con operadores RxJS (`switchMap`, `combineLatest`) en un servicio.
- La misma condición (`user.role === 'admin' && ...`) aparece en varios lugares → función/`computed` con nombre (`canEditProduct`).
- Un `ngOnInit` largo → dividir en métodos con nombre o mover a un store.

---

## 7. Estado y reactividad

- **Signals** para estado síncrono y de UI: `signal`, `computed`, `linkedSignal` cuando aplique.
- **RxJS** para flujos asíncronos y eventos en el tiempo (HTTP, websockets, debounce de búsqueda). Convertí con `toSignal()` / `toObservable()` en el borde.
- `effect()` solo para efectos secundarios reales (logging, sincronizar con localStorage, APIs no-Angular). **Nunca** para derivar estado → para eso es `computed`.
- Evitá `subscribe()` manual en componentes. Preferí `toSignal()` o el pipe `async`. Si es inevitable, usá `takeUntilDestroyed()`.
- Estado inmutable: `update(list => [...list, item])`, nunca mutar arrays/objetos dentro de un signal.
- Exponé estado de solo lectura: `private readonly _items = signal<Item[]>([]); readonly items = this._items.asReadonly();`
- Para features con estado complejo considerá **NgRx SignalStore**; para casos simples, un servicio con signals alcanza. No agregues una librería de estado sin necesidad.
- Modelá los estados de carga explícitamente: `loading`, `error`, `data` (o un tipo unión `{ status: 'loading' } | { status: 'success'; data: T } | { status: 'error'; error: string }`). Considerá `resource()` / `httpResource()` si la versión lo permite.

---

## 8. Templates

- Usá el control flow nativo: `@if`, `@for`, `@switch`, `@defer`, `@let`.
- `@for` **siempre** con `track` por identificador único (`track item.id`), y con bloque `@empty` cuando corresponda.
- No llames funciones normales en el template (se ejecutan en cada ciclo). Leer signals (`product()`) sí está bien.
- Template declarativo: nada de lógica compleja inline; movela a `computed` o pipes.
- Sin estilos inline ni `style="..."` salvo casos dinámicos puntuales (`[style.width.%]`).
- Binding de clases con `[class.is-active]="active()"` en lugar de `ngClass` para casos simples.
- `NgOptimizedImage` (`ngSrc`) para imágenes.
- `@defer (on viewport)` para bloques pesados por debajo del pliegue.

---

## 9. TypeScript

- `strict: true` y `strictTemplates: true`. Nada de `any`; si no sabés el tipo, `unknown` + type guard.
- `interface`/`type` para modelos; separá **DTO** (lo que viene de la API) de **modelo de dominio** (lo que usa la app).
- Tipos unión de literales (`'pending' | 'paid'`) o `as const` en lugar de enums cuando sea posible.
- `readonly` por defecto en propiedades que no se reasignan.
- Evitá el non-null assertion `!` salvo que esté justificado.
- Funciones con tipo de retorno explícito en servicios y utils públicos.

---

## 10. HTTP y acceso a datos

- `provideHttpClient(withInterceptors([...]))` con interceptors funcionales.
- Un data service por recurso (`ProductsApi`): solo HTTP + mapeo. Sin estado de UI.
- URLs base desde configuración (`InjectionToken` o environment), nunca hardcodeadas en cada método.
- Manejo de errores: interceptor global para errores transversales (401, 500) y `catchError` local solo cuando la pantalla necesita reaccionar distinto.
- Cancelación: `switchMap` para búsquedas; evitá requests duplicados.

---

## 11. Formularios

- **Reactive Forms tipados** (`FormBuilder.nonNullable`, `FormGroup<{...}>`).
- Validadores reutilizables como funciones en `shared/utils/validators.ts`.
- Mensajes de error en un componente o pipe reutilizable, no repetidos en cada template.
- Inputs custom → `ControlValueAccessor`.
- Formularios grandes → dividir en subformularios/componentes por sección.
- Si la versión del proyecto lo soporta y el equipo lo adoptó, Signal Forms es válido; si no, no lo introduzcas por tu cuenta.

---

## 12. Routing

- Rutas por feature en `<feature>.routes.ts` cargadas con `loadChildren` / `loadComponent`.
- Guards y resolvers **funcionales** con `inject()`.
- `withComponentInputBinding()` para recibir params de ruta como `input()`.
- Títulos de página con `title` en la ruta.
- Providers con alcance de feature declarados en la ruta (`providers: [...]`) cuando el estado debe morir al salir del feature.

---

## 13. Legibilidad (prioridad alta)

### Nombres
- Archivos en kebab-case con sufijo: `product-card.component.ts`, `cart.store.ts`, `products.api.ts`, `price.pipe.ts`, `auth.guard.ts`.
- Clases en PascalCase; variables y métodos en camelCase; constantes globales en UPPER_SNAKE_CASE.
- Booleanos con prefijo: `isLoading`, `hasStock`, `canEdit`.
- Métodos de evento con `on` + evento: `onSubmit`, `onProductSelected`. Métodos de acción con verbo: `loadProducts`, `calculateTotal`.
- Nombres del **dominio del negocio**, no técnicos genéricos (`data`, `info`, `item2`, `temp` ❌).
- Observables con sufijo `$`; signals sin sufijo.

### Tamaño y forma
- Métodos de ≤ ~20 líneas, con un solo nivel de abstracción.
- Máximo 3 parámetros; si hay más, usá un objeto tipado.
- **Early returns** en lugar de `if` anidados.
- Sin números ni strings mágicos: constantes con nombre.
- Orden dentro de la clase: inyecciones → inputs/outputs → estado (signals) → computed → lifecycle → métodos públicos/protected → privados.

### Comentarios
- El código explica el **qué**; los comentarios explican el **por qué** (decisiones, workarounds, reglas de negocio no obvias).
- No dejes código comentado ni `console.log`.
- JSDoc en APIs públicas de componentes genéricos y servicios compartidos.

---

## 14. Estilos

- Estilos encapsulados por componente; evitá `::ng-deep` (si es inevitable, acotalo con `:host`).
- Design tokens con CSS custom properties (`--color-primary`, `--space-md`) en un archivo global; los componentes los consumen.
- `:host` para estilar el contenedor del componente.
- Nada de colores, tamaños o breakpoints hardcodeados repetidos.
- Mobile-first y unidades relativas (`rem`).

---

## 15. Accesibilidad

- HTML semántico (`button` para acciones, `a` para navegación, `label` asociado a inputs).
- Todo interactivo debe funcionar con teclado y tener foco visible.
- `alt` en imágenes; `aria-*` solo cuando el HTML semántico no alcance.
- Contraste suficiente; no transmitir información solo con color.

---

## 16. Rendimiento

- `OnPush` en todos los componentes.
- Lazy loading de features y `@defer` para bloques pesados.
- `track` en `@for`.
- Pipes puros y `computed` en lugar de funciones en el template.
- Evitá importar librerías completas (importá solo lo necesario).
- Revisá el tamaño del bundle con los budgets de `angular.json`.

---

## 17. Testing

- Testeá **comportamiento**, no implementación.
- Funciones puras y servicios de dominio: tests unitarios simples (prioridad alta, son baratos).
- Componentes presentacionales: inputs → render, interacción → output.
- Pages: mockear facades/stores, no cada servicio interno.
- Un archivo `.spec.ts` junto al archivo que prueba.

---

## 18. Seguridad

- Nunca uses `bypassSecurityTrust*` sin sanitizar y justificar.
- No uses `innerHTML` con datos del usuario sin sanitizar.
- Nunca guardes secretos ni API keys en el frontend.
- Los guards son UX, no seguridad: la autorización real vive en el backend.

---

## 19. Anti-patrones a detectar y corregir

- ❌ Componente "dios" con HTTP, estado, reglas de negocio y 400+ líneas.
- ❌ `subscribe` anidados o sin desuscripción.
- ❌ Lógica de negocio en templates.
- ❌ Copiar estado de un servicio a una variable local y desincronizarlo.
- ❌ `shared/` que importa de un feature.
- ❌ Componente genérico con `if (feature === 'x')`.
- ❌ `BaseComponent` con herencia para compartir lógica (usar composición / funciones `inject`).
- ❌ `any`, `!` injustificados, `setTimeout` para "arreglar" detección de cambios.
- ❌ Mutar arrays/objetos dentro de signals.
- ❌ Usar `effect()` para calcular estado derivado.
- ❌ Un único `SharedModule` gigante que importa todo.
- ❌ Strings de URL, roles o estados repetidos por todo el código.

---

## 20. Forma de trabajar (proceso del agente)

1. **Analizá antes de escribir.** Revisá la estructura existente, la versión de Angular y las convenciones del proyecto. Buscá si ya existe un componente, servicio, pipe o util que resuelva lo que necesitás antes de crear uno nuevo.
2. **Decidí la ubicación** de cada pieza usando las secciones 3, 5 y 6.
3. **Implementá lo mínimo necesario** respetando estas reglas.
4. **Refactor incremental:** si detectás problemas fuera del alcance de la tarea, no los refactorices todos de golpe. Corregí lo que toca la tarea y **listá el resto como sugerencias**.
5. **Explicá tus decisiones** brevemente al final: qué extrajiste, por qué, y qué alternativas descartaste.
6. **Pedí confirmación** antes de cambios estructurales grandes (mover features, cambiar la librería de estado, renombrar masivamente).

---

## 21. Checklist final antes de entregar

- [ ] ¿Cada clase tiene una sola responsabilidad?
- [ ] ¿La lógica de negocio está fuera de los componentes presentacionales?
- [ ] ¿No hay HTTP directo en componentes?
- [ ] ¿Componentes `standalone` + `OnPush`?
- [ ] ¿Se usan `input()`/`output()`/`inject()` según la versión del proyecto?
- [ ] ¿`@for` con `track`? ¿Sin funciones costosas en el template?
- [ ] ¿Sin `subscribe` manual sin limpieza?
- [ ] ¿Sin `any`, sin números/strings mágicos?
- [ ] ¿Se respetan las reglas de dependencia entre `core`, `shared` y `features`?
- [ ] ¿Se reutilizó lo existente antes de crear algo nuevo?
- [ ] ¿El genérico (si hay) es libre de negocio y extensible por proyección/templates?
- [ ] ¿Nombres claros del dominio, métodos cortos, early returns?
- [ ] ¿Accesible por teclado y semántico?
- [ ] ¿Se explicaron las decisiones y se listaron mejoras pendientes fuera de alcance?
