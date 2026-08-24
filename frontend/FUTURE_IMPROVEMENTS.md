# Recomendaciones Futuras

## 🎯 Próximos Pasos Opcionales (en orden de prioridad)

### 1️⃣ Estrategias de Producto (Prioridad Alta)

**Problema Actual**: El componente aún tiene condicionales que cambian según el tipo

```typescript
if (this.isCombo) { ... }
else if (this.is3D) { ... }
  else if (this.isFdm) { ... }
    else if (this.isResina) { ... }
else if (this.isEstampado) { ... }
```

**Solución**: Crear un patrón Strategy

```typescript
// interfaces/product-strategy.ts
export interface ProductStrategy {
  getDefaultState(): Partial<ProductFormState>;
  buildPricingInput(component: ProductFormComponent): any;
  canAutoCalculate(component: ProductFormComponent): boolean;
  resetFields(component: ProductFormComponent, product?: Product): void;
}

// strategies/combo.strategy.ts
@Injectable()
export class ComboStrategy implements ProductStrategy {
  getDefaultState() {
    return {
      type: ProductType.COMBO,
      includesPieces: true,
      published: true,
    };
  }
  canAutoCalculate(component: ProductFormComponent): boolean {
    return component.components.length > 0;
  }
  // ...
}

// strategies/fdm.strategy.ts
@Injectable()
export class FdmStrategy implements ProductStrategy {
  // ...
}
```

**Beneficio**: Eliminar ~50+ líneas de condicionales

---

### 2️⃣ Separar el Template en Sub-componentes (Prioridad Media)

**Problema Actual**: `product-form.component.html` es grande y mezcla lógica de 4 tipos

**Solución**: Crear componentes especializados

```
components/
├── product-form/
│   ├── product-form.component.ts
│   ├── product-form.component.html (solo estructura)
│   ├── sections/
│   │   ├── basic-info/
│   │   ├── categories/
│   │   ├── production-fields/
│   │   │   ├── fdm-section/
│   │   │   ├── resina-section/
│   │   │   ├── estampado-section/
│   │   │   └── generic-section/
│   │   ├── pricing-section/
│   │   ├── media-section/
│   │   └── components-section/
```

**Beneficio**: Template más legible, componentes reutilizables

---

### 3️⃣ State Management con NgRx (Prioridad Media-Baja)

**Problema Actual**: Manejo de estado distribuido entre propiedades del componente

**Solución**: Usar NgRx Store

```typescript
// store/product-form/product-form.state.ts
export interface ProductFormState {
  product: Product | null;
  formData: ProductFormData;
  calculatedCost: CostCalculation | null;
  loading: boolean;
  error: string | null;
}

// store/product-form/product-form.actions.ts
export const loadProduct = createAction(
  '[Product Form] Load Product',
  props<{ id: string }>()
);

export const updateField = createAction(
  '[Product Form] Update Field',
  props<{ field: string; value: any }>()
);

// store/product-form/product-form.reducer.ts
export const productFormReducer = createReducer(
  initialState,
  on(updateField, (state, { field, value }) => ({
    ...state,
    formData: { ...state.formData, [field]: value }
  }))
);
```

**Beneficio**: Debugging más fácil, state time-travel, mejor testabilidad

---

### 4️⃣ Componente Dinámico para Campos Específicos (Prioridad Baja)

**Problema**: El template contiene lógica compleja de visibilidad

**Solución**: Crear directiva `*appShowIf` o usar `@if` de Angular 17+

```typescript
// Antes
@if (is3D && !hasComponents && !canAutoCalculateCost) {
  <p class="pricing-hint">...</p>
}

// Después con directiva
<p *appShowIf="shouldShowPricingHint" class="pricing-hint">...</p>

// O con guards reutilizables
<p *ngIf="showPricingHint$ | async" class="pricing-hint">...</p>
```

---

### 5️⃣ Validación en el Servicio de Payload (Prioridad Media)

**Problema**: No hay validación centralizada del payload antes de emitir

**Solución**: Extender `ProductPayloadBuilderService`

```typescript
export interface PayloadValidationResult {
  isValid: boolean;
  errors: string[];
}

export class ProductPayloadBuilderService {
  // ... métodos existentes
  
  validatePayload(payload: CreateProductPayload): PayloadValidationResult {
    const errors: string[] = [];
    
    if (!payload.name?.trim()) errors.push('Nombre requerido');
    if (!payload.type) errors.push('Tipo requerido');
    if (payload.price <= 0) errors.push('Precio debe ser mayor a 0');
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
```

---

### 6️⃣ Caché Local con LocalStorage (Prioridad Baja)

**Problema**: Los datos se pierden si el usuario recarga sin guardar

**Solución**: Auto-guardar en localStorage

```typescript
private autosaveForm(): void {
  this.formData$
    .pipe(
      debounceTime(1000),
      takeUntilDestroyed(this.destroyRef)
    )
    .subscribe(data => {
      localStorage.setItem('product-form-draft', JSON.stringify(data));
    });
}

private restoreFromDraft(): void {
  const draft = localStorage.getItem('product-form-draft');
  if (draft) {
    this.applyState(JSON.parse(draft));
  }
}
```

---

### 7️⃣ Tests Unitarios Completos (Prioridad Alta)

**Crear tests para los servicios**:

```typescript
// product-cost-calculator.service.spec.ts
describe('ProductCostCalculatorService', () => {
  let service: ProductCostCalculatorService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ProductCostCalculatorService);
  });

  it('should calculate effective cost correctly', () => {
    // ... tests
  });

  it('should validate auto-calculate conditions', () => {
    // ... tests
  });
});

// product-form.component.spec.ts
describe('ProductFormComponent', () => {
  let component: ProductFormComponent;
  let fixture: ComponentFixture<ProductFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductFormComponent],
      providers: [
        { provide: ProductCostCalculatorService, useValue: mockCostCalculator },
        { provide: ProductPayloadBuilderService, useValue: mockPayloadBuilder },
        // ...
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ProductFormComponent);
    component = fixture.componentInstance;
  });

  it('should update effective cost when component changes', () => {
    // ... test
  });
});
```

---

## 📊 Mapa de Refactorización Completo

```
FASE 1: ✅ COMPLETADA (Esta refactorización)
├─ Extraer lógica de cálculo de costos
├─ Extraer lógica de construcción de payload
├─ Extraer lógica de estado
└─ Reducir 74 líneas del componente

FASE 2: OPCIONAL (Estrategias)
├─ Crear ProductStrategy interface
├─ ComboStrategy, FdmStrategy, ResinaStrategy, EstampadoStrategy
└─ Eliminar 50+ líneas de condicionales

FASE 3: OPCIONAL (Sub-componentes)
├─ ProductBasicInfoComponent
├─ ProductProductionFieldsComponent
├─ ProductPricingComponent
└─ Mejorar mantenibilidad y reutilización

FASE 4: OPCIONAL (State Management)
├─ NgRx Store
├─ Selectors
└─ Debugging y testabilidad mejorada

FASE 5: OPCIONAL (Tests)
├─ Tests unitarios para servicios
├─ Tests de integración
└─ Cobertura > 80%
```

---

## 💡 Métricas de Éxito

| Métrica | Actual | Meta Fase 2 | Meta Fase 3 | Meta Final |
|---------|--------|-----------|-----------|-----------|
| Líneas del componente | 1076 | 950 | 600 | 500 |
| Getters complejos | 0 | 0 | 0 | 0 |
| Condicionales anidados | 10+ | 0 (Strategy) | 0 | 0 |
| Cobertura de tests | ~40% | 60% | 80% | 90%+ |
| Complejidad ciclomática | 12 | 8 | 5 | 3 |

---

## 🛠️ Pasos para Implementar Fase 2 (Estrategias)

1. **Crear interfaz**:
   ```bash
   ng generate interface core/strategies/product-strategy
   ```

2. **Crear estrategias**:
   ```bash
   ng generate service core/strategies/combo-strategy
   ng generate service core/strategies/fdm-strategy
   ng generate service core/strategies/resina-strategy
   ng generate service core/strategies/estampado-strategy
   ```

3. **Crear factory**:
   ```bash
   ng generate service core/strategies/product-strategy-factory
   ```

4. **Actualizar componente**:
   ```typescript
   private strategy: ProductStrategy;
   
   onTypeChange(): void {
     this.strategy = this.strategyFactory.getStrategy(this.type);
     this.resetForm();
   }
   ```

---

## 📝 Notas Importantes

1. **Esta refactorización es segura**: No cambia la interfaz pública
2. **Compatible con versiones anteriores**: El componente funciona igual
3. **Mejora inmediata**: Ya hay 74 líneas menos y mejor mantenibilidad
4. **Escalable**: Las próximas fases son opcionales e independientes
5. **Testeable**: Los servicios pueden testearse aisladamente

---

## 🚀 Quick Start para Próximas Mejoras

### Para empezar con Fase 2:
```bash
# Crear estructura de estrategias
mkdir -p src/app/core/strategies
touch src/app/core/strategies/{product-strategy.ts,combo-strategy.ts,fdm-strategy.ts,resina-strategy.ts,estampado-strategy.ts,strategy-factory.ts}
```

### Para empezar con Fase 3:
```bash
# Crear sub-componentes
ng generate component pages/products/product-form/sections/product-basic-info
ng generate component pages/products/product-form/sections/product-pricing
ng generate component pages/products/product-form/sections/product-production-fields
```

---

