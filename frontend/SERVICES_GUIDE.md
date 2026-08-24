# Guía de Servicios Extraídos

## 1. ProductCostCalculatorService

**Ubicación**: `src/app/core/services/product-cost-calculator.service.ts`

**Responsabilidad**: Centralizar toda la lógica de cálculo de costos y validaciones

### Interfaces

```typescript
interface CostCalculationInput {
  type: ProductType;
  usesPieceAssembly: boolean;
  cost: number;
  productCost?: number;
  costBreakdown: CostBreakdown | null;
  componentsCostTotal: number;
  components: any[];
}

interface PriceCalculationInput extends CostCalculationInput {
  suggestedPrice: number | null;
  computedPrice: number | null;
  componentsPriceTotal: number;
  configuredProfitMargin: number;
  profitMargins: any;
}
```

### Métodos

#### `calculateEffectiveCost(input: CostCalculationInput): number`
Calcula el costo real del producto considerando:
- Si usa assembly de piezas
- Si tiene breakdown de costos
- Costo de componentes

**Lógica de precedencia**:
1. Si es assembly y tiene breakdown, usa breakdown
2. Si es assembly y tiene costo manual, usa costo manual
3. Si es assembly, suma costo de componentes
4. Si no es assembly, prioriza: costo manual > breakdown > 0

#### `calculateProfit(finalPrice: number, effectiveCost: number): number`
Diferencia simple: `finalPrice - effectiveCost`

#### `canAutoCalculate(...): boolean`
Valida si el componente tiene suficiente información para calcular costo automáticamente.

**Reglas**:
- **COMBO**: Requiere componentes
- **PIECE_ASSEMBLY**: Requiere componentes
- **ESTAMPADO**: Requiere prints o supplies válidos
- **FDM**: Requiere filamentos válidos
- **RESINA**: Requiere grams > 0
- **Otros 3D**: Requiere grams > 0

---

## 2. ProductPayloadBuilderService

**Ubicación**: `src/app/core/services/product-payload-builder.service.ts`

**Responsabilidad**: Construir de forma consistente los objetos payload del producto

### Interfaces

```typescript
interface ProductPayloadInput {
  type: ProductType;
  name: string;
  isCombo: boolean;
  is3D: boolean;
  isFdm: boolean;
  isResina: boolean;
  isEstampado: boolean;
  usesPieceAssembly: boolean;
  finalPrice: number;
  effectiveCost: number;
  suggestedPrice: number | null;
  categoryIds: string[];
  images: string[];
  attachments: ProductAttachment[];
  published: boolean;
  components: ProductComponent[];
  assemblyTimeHours: number;
  grams: number;
  totalFilamentGrams: number;
  printTimeHours: number;
  workTimeHours: number;
  filaments: FdmFilamentLine[];
  filamentType: FilamentType;
  filamentLines: FdmFilamentLine[];
  resinType: ResinType;
  washMinutes: number;
  cureMinutes: number;
  prints: EstampadoPrintSpec[];
  pressCycles: EstampadoPressCycle[];
  supplyLines: EstampadoSupplyLine[];
  sizeWidthCm: number;
  sizeLengthCm: number;
  sizeHeightCm: number;
  impresos: any[];
}
```

### Métodos

#### `buildProductSize(...): string`
Calcula el tamaño del producto según su tipo:
- **COMBO**: "Combo"
- **ESTAMPADO (sin assembly)**: Formato desde prints
- **Otros**: Formato "WxLxH cm"

#### `buildCreatePayload(input: ProductPayloadInput): CreateProductPayload`
Construye el payload completo con:
- Datos básicos (nombre, tipo, tamaño)
- Precios y costos
- Categorías e imágenes
- Campos específicos por tipo (3D, Estampado, etc)

**Ejemplo de uso**:
```typescript
const payload = this.payloadBuilder.buildCreatePayload({
  type: ProductType.FDM,
  name: 'Mi Producto',
  // ... otros campos
});
this.save.emit(payload);
```

#### `buildPricingInput(...): any`
Construye el objeto de entrada para cálculos de precio.

**Importante**: Es reutilizado en múltiples lugares:
- `runPricingPreviewWithSettings()`
- `recalculatePriceFromCost()`
- `calculateCost()`

**Elimina**: 50+ líneas de lógica condicional duplicada

---

## 3. ProductFormStateManagerService

**Ubicación**: `src/app/core/services/product-form-state-manager.service.ts`

**Responsabilidad**: Gestionar la inicialización y reset del estado del formulario

### Interfaces

```typescript
interface ProductFormState {
  type: ProductType;
  name: string;
  sizeWidthCm: number;
  // ... 30+ propiedades
}
```

### Métodos

#### `createInitialState(): ProductFormState`
Retorna el estado inicial para un nuevo producto con valores por defecto:
- Tipo: FDM
- Nombre: vacío
- Dimensiones: 0
- Filamentos: array con una línea vacía
- Etc

**Uso**:
```typescript
const initialState = this.stateManager.createInitialState();
```

#### `loadFromProduct(product: Product, catalogProducts: Product[]): ProductFormState`
Carga el estado completo desde un producto existente.

**Maneja casos especiales**:
- **COMBO**: Set `includesPieces = true`
- **FDM/RESINA**: Normaliza filamentos, grams, tiempos
- **ESTAMPADO**: Carga prints, cycles, supplies
- **Legacy images**: Detecta URLs antiguas

**Complejidad anterior**: 100+ líneas de if/else

**Ahora**: 1 llamada a servicio

#### `resetPricingState(state: Partial<ProductFormState>): void`
Limpia el estado de precios:
- `costBreakdown = null`
- `computedPrice = null`
- `appliedMarginPercent = null`

#### `resetComponents(state: Partial<ProductFormState>): void`
Limpia los componentes y campos relacionados

---

## 🔄 Flujo de Uso en el Componente

### 1. Inicialización

```typescript
ngOnInit() {
  // ... cargar datos
  this.loadCatalog();
  this.loadImpresos();
  this.loadEstampadoSupplies();
}

ngOnChanges(changes: SimpleChanges) {
  if (changes['product']) {
    this.resetForm();
  }
}
```

### 2. Reset del Formulario

```typescript
private resetForm(): void {
  if (this.product) {
    // Delega al servicio
    const state = this.stateManager.loadFromProduct(
      this.product, 
      this.catalogProducts
    );
    this.applyState(state);
  } else {
    // Nuevo producto
    const initialState = this.stateManager.createInitialState();
    this.applyState(initialState);
  }
  this.scheduleCostCalculation();
}
```

### 3. Cálculo de Costo

```typescript
private calculateCost(): void {
  if (this.usesPieceAssembly) {
    this.runPricingPreview();
    return;
  }
  // ... validaciones
  this.runPricingPreview();
}

private runPricingPreviewWithSettings(settings: GeneralSettings): void {
  // Usa el servicio para construir el input
  const input = this.buildPricingInput();
  
  this.productPricing.preview(input, this.catalogProducts, settings)
    .subscribe({
      next: (result) => {
        this.costBreakdown = result.breakdown;
        this.cost = resolvedCost;
        this.computedPrice = result.price;
      }
    });
}

private buildPricingInput() {
  // Delega al servicio
  return this.payloadBuilder.buildPricingInput(
    this.type,
    this.usesPieceAssembly,
    this.components,
    // ... resto de parámetros
  );
}
```

### 4. Envío del Formulario

```typescript
async onSubmit(): Promise<void> {
  // ... upload de archivos
  
  // Construye el payload usando el servicio
  const payload = this.payloadBuilder.buildCreatePayload({
    type: this.type,
    name: this.name,
    // ... resto de datos
  });
  
  this.save.emit(payload);
}
```

---

## 🧪 Ejemplos de Tests

### Test de ProductCostCalculatorService

```typescript
describe('ProductCostCalculatorService', () => {
  let service: ProductCostCalculatorService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ProductCostCalculatorService);
  });

  it('should calculate effective cost for single product', () => {
    const result = service.calculateEffectiveCost({
      type: ProductType.FDM,
      usesPieceAssembly: false,
      cost: 100,
      costBreakdown: null,
      componentsCostTotal: 0,
      components: [],
    });
    expect(result).toBe(100);
  });

  it('should prioritize breakdown over manual cost', () => {
    const result = service.calculateEffectiveCost({
      type: ProductType.FDM,
      usesPieceAssembly: false,
      cost: 100,
      costBreakdown: { ... },
      componentsCostTotal: 0,
      components: [],
    });
    expect(result).toBe(totalCostFromBreakdown(...));
  });
});
```

---

## 📝 Consideraciones

1. **Inyección de dependencias**: Los servicios usan `providedIn: 'root'` para ser singleton
2. **No tienen estado**: Son servicios puros que reciben inputs y retornan outputs
3. **Reutilizables**: Pueden usarse en otros componentes o servicios
4. **Testables**: Fáciles de mockear y testear en aislamiento

