import { ProductType, SupplyCategory } from '../common/enums';
import type { Product, ProductPricingInput } from '../common/interfaces';
import { CostCalculatorService } from './cost-calculator.service';
import { StoreService } from '../store/store.service';
import { createEmptyState } from '../store/store.seed';
import { createDefaultMachineProfiles } from './machine-profile.util';

function setPaperPricePerSqm(
  store: StoreService,
  key: 'sublimacion' | 'dtf' | 'dtfUv',
  pricePerSqm: number,
): void {
  store.generalSettings.paperPricesPerSqm[key] = pricePerSqm;
}

describe('CostCalculatorService', () => {
  let store: StoreService;
  let service: CostCalculatorService;

  beforeEach(() => {
    store = new StoreService();
    store.applyState(createEmptyState());
    store.generalSettings = {
      ...store.generalSettings,
      electricityCostPerKwh: 100,
      errorMarginPercent: 10,
      laborCostPerHour: 500,
      modelingRatePerHour: 0,
      graphicDesignRatePerHour: 0,
      machineProfiles: createDefaultMachineProfiles().map((profile) =>
        profile.id === 'mp-res-wash'
          ? { ...profile, washSupplyId: 'sup-alcohol' }
          : profile,
      ),
      filamentPrices: [
        {
          id: 'fp-1',
          brand: 'Test',
          materialType: 'pla',
          pricePerKg: 10000,
        },
      ],
      resinPrices: [
        {
          id: 'rp-1',
          brand: 'Test',
          resinType: 'estandar',
          pricePerLiter: 30000,
        },
      ],
    };
    store.supplies.push({
      id: 'sup-alcohol',
      name: 'Alcohol isopropílico',
      category: SupplyCategory.RESINA,
      unit: 'L',
      quantity: 2,
      minStock: 0.5,
      unitPrice: 5000,
      priceFromSettings: false,
      updatedAt: new Date().toISOString(),
    });
    service = new CostCalculatorService(store);
  });

  it('aplica margen de error sobre material, energía y máquina', () => {
    const result = service.calculateCost({
      type: ProductType.FDM,
      grams: 100,
      printTimeHours: 2,
      workTimeHours: 0,
      brand: 'Test',
      filamentType: 'pla' as never,
    });

    const base =
      result.materialCost +
      (result.purgeCost ?? 0) +
      result.energyCost +
      result.machineCost;
    expect(result.errorMarginCost).toBe(Math.round(base * 0.1));
    expect(result.totalCost).toBe(
      base + result.errorMarginCost + result.laborCost,
    );
  });

  it('incluye purgeCost FDM en el desglose y en el margen de error', () => {
    store.generalSettings.filamentTypeAverages = { pla: 20000, petg: 14000 };
    store.generalSettings.errorMarginPercent = 10;

    const result = service.calculateCost({
      type: ProductType.FDM,
      grams: 100,
      purgeGrams: 9,
      printTimeHours: 0,
      workTimeHours: 0,
      filaments: [
        { id: 'a', filamentType: 'pla' as never, grams: 30 },
        { id: 'b', filamentType: 'petg' as never, grams: 70 },
      ],
    });

    // material: 30/1000*20000 + 70/1000*14000 = 600 + 980 = 1580
    expect(result.materialCost).toBe(1580);
    // purge: 9/1000 * ((20000+14000)/2) = 153
    expect(result.purgeCost).toBe(153);
    const base =
      result.materialCost +
      (result.purgeCost ?? 0) +
      result.energyCost +
      result.machineCost;
    expect(result.errorMarginCost).toBe(Math.round(base * 0.1));
    expect(result.totalCost).toBe(
      base + result.errorMarginCost + result.laborCost,
    );
  });

  it('calcula costo FDM con material, energía y mano de obra', () => {
    const result = service.calculateCost({
      type: ProductType.FDM,
      grams: 100,
      printTimeHours: 2,
      workTimeHours: 1,
      brand: 'Test',
      filamentType: 'pla' as never,
    });

    expect(result.materialCost).toBeGreaterThan(0);
    expect(result.laborCost).toBe(500);
    expect(result.totalCost).toBeGreaterThan(result.laborCost);
  });

  it('calcula costo de resina con lavado, curado e insumo', () => {
    const result = service.calculateCost({
      type: ProductType.RESINA,
      grams: 50,
      printTimeHours: 1,
      workTimeHours: 0.5,
      washMinutes: 8,
      cureMinutes: 10,
      resinType: 'estandar',
    });

    expect(result.materialCost).toBeGreaterThan(40);
    expect(result.energyCost).toBeGreaterThan(0);
    expect(result.machineCost).toBeGreaterThan(0);
  });

  it('incluye costo de papel en productos estampados con dimensiones', () => {
    setPaperPricePerSqm(store, 'dtf', 6500);

    const result = service.calculateCost({
      type: ProductType.ESTAMPADO,
      estampadoPrints: [
        {
          id: 'p1',
          paperType: 'dtf' as never,
          widthCm: 10,
          heightCm: 10,
        },
      ],
      pressMinutes: 0,
      workTimeHours: 0,
    });

    expect(result.materialCost).toBe(65);
  });

  it('suma minutos de plancha según cantidad de bajadas', () => {
    const result = service.calculateCost({
      type: ProductType.ESTAMPADO,
      estampadoPressCycles: [{ id: 'c1', pressMinutes: 2, bajadas: 3 }],
      workTimeHours: 0,
    });

    expect(result.energyCost).toBeGreaterThan(0);
    expect(result.machineCost).toBeGreaterThan(0);
  });

  it('calcula costo de estampado por ciclo de plancha', () => {
    const result = service.calculateCost({
      type: ProductType.ESTAMPADO,
      pressMinutes: 2,
      workTimeHours: 0.5,
    });

    expect(result.energyCost).toBeGreaterThan(0);
    expect(result.laborCost).toBe(250);
  });

  it('usa precio promedio por tipo cuando el producto no tiene marca', () => {
    store.generalSettings.filamentTypeAverages = { pla: 20000 };

    const result = service.calculateCost({
      type: ProductType.FDM,
      grams: 1000,
      printTimeHours: 0,
      workTimeHours: 0,
      filamentType: 'pla' as never,
    });

    expect(result.materialCost).toBe(20000);
  });

  it('cotiza el filamento con el promedio del tipo aunque haya marca', () => {
    store.generalSettings.filamentTypeAverages = { pla: 20000 };

    const result = service.calculateCost({
      type: ProductType.FDM,
      grams: 1000,
      printTimeHours: 0,
      workTimeHours: 0,
      brand: 'Test',
      filamentType: 'pla' as never,
    });

    expect(result.materialCost).toBe(20000);
  });

  it('calcula costo de papel por área', () => {
    setPaperPricePerSqm(store, 'sublimacion', 4000);
    const result = service.calculateImpresoPaperCost(
      'sublimacion' as never,
      100,
      100,
    );

    expect(result.areaSqm).toBe(1);
    expect(result.paperCost).toBe(4000);
  });

  it('aplica el margen de ganancia configurado en Ajustes → Ganancias', () => {
    store.generalSettings.profitMargins = {
      impresion_3d: 55,
      diseno_grafico: 50,
      modelado: 50,
      estampado: 25,
    };

    const result = service.calculateProductPricing({
      type: ProductType.FDM,
      grams: 100,
      printTimeHours: 2,
      workTimeHours: 0,
      brand: 'Test',
      filamentType: 'pla' as never,
    });

    expect(result.cost).toBeGreaterThan(0);
    expect(result.configuredMarginPercent).toBe(55);
    expect(result.price).toBe(Math.round(result.cost * 1.55));
  });

  it('usa costo guardado y nuevo margen cuando el recálculo automático da 0', () => {
    store.generalSettings.profitMargins = {
      impresion_3d: 50,
      diseno_grafico: 50,
      modelado: 50,
      estampado: 35,
    };
    store.generalSettings.filamentPrices = [];

    const result = service.calculateProductPricing({
      type: ProductType.FDM,
      grams: 100,
      printTimeHours: 0,
      workTimeHours: 0,
      filamentType: 'pla' as never,
      cost: 4000,
      price: 6000,
    });

    expect(result.cost).toBe(4000);
    expect(result.configuredMarginPercent).toBe(50);
    expect(result.price).toBe(6000);
  });

  it('resuelve costo de producto armado como suma de piezas', () => {
    store.products.push(
      {
        id: 'piece-1',
        name: 'Pieza',
        type: ProductType.FDM,
        images: [],
        attachments: [],
        updatedAt: '2026-07-01T10:00:00.000Z',
        price: 2000,
        cost: 1000,
        profit: 1000,
        categoryIds: [],
        size: '5 cm',
        published: true,
        includesPieces: false,
        components: [],
        assemblyTimeHours: 0,
        grams: 0, // sin datos de impresión: el costo guardado es el vigente
        printTimeHours: 1,
        workTimeHours: 0,
      },
      {
        id: 'combo-1',
        name: 'Combo',
        type: ProductType.FDM,
        includesPieces: true,
        images: [],
        attachments: [],
        updatedAt: '2026-07-01T10:00:00.000Z',
        price: 9999,
        cost: 9999,
        profit: 0,
        categoryIds: [],
        size: '10 cm',
        published: true,
        components: [{ productId: 'piece-1', quantity: 2 }],
        assemblyTimeHours: 0,
        grams: 100,
        printTimeHours: 5,
        workTimeHours: 0,
      },
    );
    store.indexProduct(store.products[0]);
    store.indexProduct(store.products[1]);

    expect(service.resolveProductUnitCost('combo-1')).toBe(2000);
  });

  it('el precio del combo es costo total x margen, o el precio sugerido', () => {
    const piece = {
      id: 'piece-1',
      name: 'Pieza',
      type: ProductType.FDM,
      images: [],
      attachments: [],
      updatedAt: '2026-07-01T10:00:00.000Z',
      price: 5000,
      cost: 1000,
      profit: 4000,
      categoryIds: [],
      size: '5 cm',
      published: true,
      includesPieces: false,
      components: [],
      assemblyTimeHours: 0,
      grams: 0,
      printTimeHours: 1,
      workTimeHours: 0,
    } as unknown as Product;
    store.products.push(piece);
    store.indexProduct(piece);

    const input = {
      type: ProductType.FDM,
      components: [{ productId: 'piece-1', quantity: 2 }],
      assemblyTimeHours: 0,
    } as ProductPricingInput;
    const margin = service.getMarginForProductType(ProductType.FDM);

    const result = service.calculateProductPricing(input);
    expect(result.cost).toBe(2000);
    expect(result.price).toBe(service.priceFromCostAndMargin(2000, margin));
    expect(result.price).not.toBe(10000);

    expect(
      service.calculateProductPricing({ ...input, suggestedPrice: 3333 }).price,
    ).toBe(3333);
  });

  it('costo del combo usa el costo vigente de cada pieza, no el guardado', () => {
    const base = {
      images: [],
      attachments: [],
      updatedAt: '2026-07-01T10:00:00.000Z',
      categoryIds: [],
      size: '5 cm',
      published: true,
      assemblyTimeHours: 0,
    };
    store.products.push(
      {
        ...base,
        id: 'piece-old',
        name: 'Pieza',
        type: ProductType.FDM,
        price: 2000,
        cost: 5000, // guardado desactualizado
        profit: 0,
        includesPieces: false,
        components: [],
        grams: 10,
        printTimeHours: 1,
        workTimeHours: 0,
      },
      {
        ...base,
        id: 'combo-old',
        name: 'Combo',
        type: ProductType.COMBO,
        price: 9999,
        cost: 10000,
        profit: 0,
        includesPieces: true,
        components: [{ productId: 'piece-old', quantity: 2 }],
      },
    );
    store.indexProduct(store.products[0]);
    store.indexProduct(store.products[1]);

    const current = service.calculateProductPricing({
      type: ProductType.FDM,
      grams: 10,
      printTimeHours: 1,
      workTimeHours: 0,
      cost: 0,
    }).cost;
    expect(current).not.toBe(5000);

    expect(service.resolveProductUnitCost('piece-old')).toBe(current);
    expect(service.resolveProductUnitCost('combo-old')).toBe(current * 2);
    expect(
      service.calculateCompositeCost(
        [{ productId: 'piece-old', quantity: 2 }],
        0,
        ProductType.COMBO,
      ).totalCost,
    ).toBe(current * 2);
  });

  it('no aplica margen de error en productos armados por piezas', () => {
    store.generalSettings.errorMarginPercent = 10;
    store.products.push({
      id: 'piece-1',
      name: 'Pieza',
      type: ProductType.FDM,
      images: [],
      attachments: [],
      updatedAt: '2026-07-01T10:00:00.000Z',
      price: 2000,
      cost: 1000,
      profit: 1000,
      categoryIds: [],
      size: '5 cm',
      published: true,
      components: [],
      assemblyTimeHours: 0,
      includesPieces: false,
      grams: 0,
      printTimeHours: 1,
      workTimeHours: 0,
    });
    store.indexProduct(store.products[0]);

    const result = service.calculateCompositeCost(
      [{ productId: 'piece-1', quantity: 2 }],
      0,
    );

    expect(result.materialCost).toBe(2000);
    expect(result.errorMarginCost).toBe(0);
    expect(result.totalCost).toBe(2000);
  });

  it('suma el costo de múltiples filamentos FDM', () => {
    store.generalSettings.profitMargins = {
      impresion_3d: 0,
      diseno_grafico: 0,
      modelado: 0,
      estampado: 0,
    };
    store.generalSettings.filamentTypeAverages = {
      pla: 10000,
      tpu: 20000,
    };

    const result = service.calculateCost({
      type: ProductType.FDM,
      grams: 0,
      printTimeHours: 0,
      workTimeHours: 0,
      filaments: [
        { id: 'ff-1', filamentType: 'pla' as never, grams: 50 },
        { id: 'ff-2', filamentType: 'tpu' as never, grams: 20 },
      ],
    });

    expect(result.materialCost).toBe(900);
  });

  it('suma el insumo encima del margen, sin aplicárselo', () => {
    store.generalSettings.errorMarginPercent = 0;
    store.generalSettings.profitMargins = {
      impresion_3d: 50,
      diseno_grafico: 0,
      modelado: 0,
      estampado: 50,
    };
    store.supplies.push({
      id: 'sup-polimero',
      name: 'Polímero',
      category: SupplyCategory.GENERAL,
      unit: 'u',
      quantity: 10,
      minStock: 0,
      unitPrice: 800,
      priceFromSettings: false,
      updatedAt: new Date().toISOString(),
    });

    const baseInput = {
      type: ProductType.FDM,
      grams: 100,
      printTimeHours: 0,
      workTimeHours: 0,
      brand: 'Test',
      filamentType: 'pla' as never,
    };
    const base = service.calculateProductPricing(baseInput);
    const withSupply = service.calculateProductPricing({
      ...baseInput,
      estampadoSupplies: [{ id: 'l1', supplyId: 'sup-polimero', quantity: 1 }],
    });

    expect(base.cost).toBe(1000);
    expect(base.price).toBe(1500);
    expect(withSupply.cost).toBe(1800);
    expect(withSupply.price).toBe(2300);
    expect(withSupply.profit).toBe(base.profit);
    expect(withSupply.profit).toBe(500);
  });

  it('suma el insumo encima del precio sugerido', () => {
    store.generalSettings.errorMarginPercent = 0;
    store.supplies.push({
      id: 'sup-polimero',
      name: 'Polímero',
      category: SupplyCategory.GENERAL,
      unit: 'u',
      quantity: 10,
      minStock: 0,
      unitPrice: 800,
      priceFromSettings: false,
      updatedAt: new Date().toISOString(),
    });

    const result = service.calculateProductPricing({
      type: ProductType.FDM,
      grams: 100,
      printTimeHours: 0,
      workTimeHours: 0,
      brand: 'Test',
      filamentType: 'pla' as never,
      suggestedPrice: 2000,
      estampadoSupplies: [{ id: 'l1', supplyId: 'sup-polimero', quantity: 1 }],
    });

    expect(result.cost).toBe(1800);
    expect(result.price).toBe(2800);
    expect(result.profit).toBe(1000);
  });

  it('no mete los insumos del producto en el costo de material del estampado', () => {
    setPaperPricePerSqm(store, 'dtf', 6500);
    store.supplies.push({
      id: 'sup-remera',
      name: 'Remera',
      category: SupplyCategory.ESTAMPADO,
      unit: 'u',
      quantity: 4,
      minStock: 0,
      unitPrice: 800,
      priceFromSettings: false,
      updatedAt: new Date().toISOString(),
    });

    const result = service.calculateCost({
      type: ProductType.ESTAMPADO,
      estampadoPrints: [
        {
          id: 'p1',
          paperType: 'dtf' as never,
          widthCm: 10,
          heightCm: 10,
        },
      ],
      estampadoSupplies: [{ id: 'l1', supplyId: 'sup-remera', quantity: 1 }],
      pressMinutes: 0,
      workTimeHours: 0,
    });

    expect(result.materialCost).toBe(65);
  });

  it('calculateFailureCost suma material + luz + máquina sin mano de obra ni margen', () => {
    store.products.push({
      id: 'prod-fail',
      name: 'Pieza',
      images: [],
      attachments: [],
      updatedAt: new Date().toISOString(),
      price: 1000,
      cost: 500,
      profit: 500,
      categoryIds: [],
      type: ProductType.FDM,
      size: '10cm',
      published: true,
      components: [],
      assemblyTimeHours: 0,
      includesPieces: false,
      grams: 50,
      printTimeHours: 1,
      workTimeHours: 0,
      stock: 0,
      filamentType: 'pla' as never,
    });

    const cost = service.calculateFailureCost(
      {
        id: 'job-1',
        orderId: '',
        orderItemIndex: -1,
        customerName: '',
        productName: 'Pieza',
        productId: 'prod-fail',
        type: 'impresion_3d' as never,
        status: 'por_hacer' as never,
        active: true,
        priority: 1,
        machine: '',
        estimatedHours: 1,
        dueDate: new Date().toISOString(),
      },
      100,
      1,
    );

    // material 0.1 kg × 10000 = 1000; FDM default 120W/1000*1*100 + 150*1
    expect(cost).toBe(1000 + 12 + 150);
  });
});
