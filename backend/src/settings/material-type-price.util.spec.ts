import { FilamentType, ResinType, SupplyCategory } from '../common/enums';
import { GeneralSettings, Supply } from '../common/interfaces';
import { normalizePaperReferenceSheets } from '../common/paper-cost.util';
import {
  averageFilamentPriceByType,
  averageResinPriceByType,
  resolveFilamentMaterialPrice,
  resolveFilamentPricePerKg,
  resolveResinMaterialPrice,
  resolveResinPricePerLiter,
} from './material-type-price.util';

function baseSettings(
  overrides: Partial<GeneralSettings> = {},
): GeneralSettings {
  return {
    electricityCostPerKwh: 0,
    errorMarginPercent: 0,
    powerConsumptions: [],
    machineCosts: [],
    machineProfiles: [],
    laborCostPerHour: 0,
    modelingRatePerHour: 0,
    graphicDesignRatePerHour: 0,
    profitMargins: {
      impresion_3d: 0,
      diseno_grafico: 0,
      modelado: 0,
      estampado: 0,
    },
    wholesaleDiscount: {
      enabled: true,
      percent: 20,
      serviceTypes: [],
    },
    paperPricesPerSqm: { sublimacion: 0, dtf: 0, dtfUv: 0 },
    paperReferenceSheets: normalizePaperReferenceSheets(undefined, {
      sublimacion: 0,
      dtf: 0,
      dtfUv: 0,
    }),
    filamentPrices: [],
    resinPrices: [],
    filamentTypeAverages: {},
    resinTypeAverages: {},
    filamentTypes: [],
    resinTypes: [],
    colors: [],
    ...overrides,
  };
}

describe('material-type-price.util', () => {
  it('promedia precios de filamento por tipo desde marcas', () => {
    const settings = baseSettings({
      filamentPrices: [
        {
          id: '1',
          brand: 'A',
          materialType: FilamentType.PLA,
          pricePerKg: 10000,
        },
        {
          id: '2',
          brand: 'B',
          materialType: FilamentType.PLA,
          pricePerKg: 20000,
        },
      ],
    });

    expect(averageFilamentPriceByType(settings, FilamentType.PLA)).toBe(15000);
  });

  it('prioriza promedio configurado sobre marcas al costear productos', () => {
    const settings = baseSettings({
      filamentTypeAverages: { [FilamentType.PLA]: 18000 },
      filamentPrices: [
        {
          id: '1',
          brand: 'A',
          materialType: FilamentType.PLA,
          pricePerKg: 10000,
        },
      ],
    });

    expect(resolveFilamentPricePerKg(settings, FilamentType.PLA)).toBe(18000);
  });

  it('promedia precios de resina por tipo desde marcas', () => {
    const settings = baseSettings({
      resinPrices: [
        {
          id: '1',
          brand: 'A',
          resinType: ResinType.ESTANDAR,
          pricePerLiter: 30000,
        },
        {
          id: '2',
          brand: 'B',
          resinType: ResinType.ESTANDAR,
          pricePerLiter: 40000,
        },
      ],
    });

    expect(averageResinPriceByType(settings, ResinType.ESTANDAR)).toBe(35000);
    expect(resolveResinPricePerLiter(settings, ResinType.ESTANDAR)).toBe(35000);
  });
});

describe('precio de material desde Insumos', () => {
  const supply = (over: Partial<Supply>): Supply =>
    ({ unit: 'kg', unitPrice: 0, ...over }) as Supply;

  it('filamento: promedia insumos del tipo, normaliza g a kg e ignora precio 0', () => {
    const settings = baseSettings({
      filamentTypeAverages: { [FilamentType.PLA]: 10036 },
    });
    const supplies = [
      supply({
        category: SupplyCategory.FDM,
        filamentType: FilamentType.PLA,
        unitPrice: 5000,
      }),
      supply({
        category: SupplyCategory.FDM,
        filamentType: FilamentType.PLA,
        unit: 'g',
        unitPrice: 7,
      }),
      supply({
        category: SupplyCategory.FDM,
        filamentType: FilamentType.PLA,
        unitPrice: 0,
      }),
      supply({
        category: SupplyCategory.FDM,
        filamentType: FilamentType.ABS,
        unitPrice: 99999,
      }),
    ];
    expect(
      resolveFilamentMaterialPrice(settings, supplies, FilamentType.PLA),
    ).toEqual({ price: 6000, source: 'supplies' });
  });

  it('filamento: sin insumos con precio usa Ajustes y lo marca como respaldo', () => {
    const settings = baseSettings({
      filamentTypeAverages: { [FilamentType.PLA]: 10036 },
    });
    expect(
      resolveFilamentMaterialPrice(settings, [], FilamentType.PLA),
    ).toEqual({ price: 10036, source: 'settings' });
    expect(
      resolveFilamentMaterialPrice(settings, [], FilamentType.PETG),
    ).toBeNull();
  });

  it('resina: promedia $/L (ml a L), prefiere la marca y respalda en Ajustes', () => {
    const settings = baseSettings({
      resinTypeAverages: { [ResinType.ESTANDAR]: 35920 },
    });
    const supplies = [
      supply({
        category: SupplyCategory.RESINA,
        resinType: ResinType.ESTANDAR,
        brand: 'Anycubic',
        unitPrice: 30000,
      }),
      supply({
        category: SupplyCategory.RESINA,
        resinType: ResinType.ESTANDAR,
        brand: 'Elegoo',
        unit: 'ml',
        unitPrice: 36,
      }),
    ];
    expect(
      resolveResinMaterialPrice(settings, supplies, ResinType.ESTANDAR),
    ).toEqual({ price: 33000, source: 'supplies' });
    expect(
      resolveResinMaterialPrice(
        settings,
        supplies,
        ResinType.ESTANDAR,
        'elegoo',
      ),
    ).toEqual({ price: 36000, source: 'supplies' });
    expect(resolveResinMaterialPrice(settings, [], ResinType.ESTANDAR)).toEqual(
      { price: 35920, source: 'settings' },
    );
  });
});
