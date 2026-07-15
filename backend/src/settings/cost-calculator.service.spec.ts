import { ProductType } from '../common/enums';
import { CostCalculatorService } from './cost-calculator.service';
import { StoreService } from '../store/store.service';
import { createEmptyState } from '../store/store.seed';
import { createDefaultMachineProfiles } from './machine-profile.util';

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
      machineProfiles: createDefaultMachineProfiles().map((profile) =>
        profile.id === 'mp-res-wash'
          ? { ...profile, washSupplyId: 'sup-alcohol' }
          : profile,
      ),
      filamentPrices: [
        {
          id: 'fp-1',
          brand: 'Test',
          materialType: 'pla' as never,
          pricePerKg: 10000,
        },
      ],
      resinPrices: [
        {
          id: 'rp-1',
          brand: 'Test',
          resinType: 'estandar' as never,
          pricePerLiter: 30000,
        },
      ],
    };
    store.supplies.push({
      id: 'sup-alcohol',
      name: 'Alcohol isopropílico',
      type: 'alcohol' as never,
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
      result.materialCost + result.energyCost + result.machineCost;
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
      resinType: 'estandar' as never,
    });

    expect(result.materialCost).toBeGreaterThan(40);
    expect(result.energyCost).toBeGreaterThan(0);
    expect(result.machineCost).toBeGreaterThan(0);
  });

  it('incluye costo de papel en productos estampados con dimensiones', () => {
    store.generalSettings.paperPricesPerSqm.dtf = 6500;

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
      estampadoPressCycles: [
        { id: 'c1', pressMinutes: 2, bajadas: 3 },
      ],
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
    store.generalSettings.filamentTypeAverages = { pla: 20000 } as never;

    const result = service.calculateCost({
      type: ProductType.FDM,
      grams: 1000,
      printTimeHours: 0,
      workTimeHours: 0,
      filamentType: 'pla' as never,
    });

    expect(result.materialCost).toBe(20000);
  });

  it('usa precio por marca cuando se indica marca en el cálculo', () => {
    store.generalSettings.filamentTypeAverages = { pla: 20000 } as never;

    const result = service.calculateCost({
      type: ProductType.FDM,
      grams: 1000,
      printTimeHours: 0,
      workTimeHours: 0,
      brand: 'Test',
      filamentType: 'pla' as never,
    });

    expect(result.materialCost).toBe(10000);
  });

  it('calcula costo de papel por área', () => {
    store.generalSettings.paperPricesPerSqm.sublimacion = 4000;
    const result = service.calculateImpresoPaperCost(
      'sublimacion' as never,
      100,
      100,
    );

    expect(result.areaSqm).toBe(1);
    expect(result.paperCost).toBe(4000);
  });
});
