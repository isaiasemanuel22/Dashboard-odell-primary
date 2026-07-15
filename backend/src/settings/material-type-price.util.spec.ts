import { FilamentType, ResinType } from '../common/enums';
import { GeneralSettings } from '../common/interfaces';
import {
  averageFilamentPriceByType,
  averageResinPriceByType,
  resolveFilamentPricePerKg,
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
    profitMargins: { impresion_3d: 0, diseno: 0, estampado: 0 },
    paperPricesPerSqm: { sublimacion: 0, dtf: 0, dtfUv: 0 },
    filamentPrices: [],
    resinPrices: [],
    filamentTypeAverages: {},
    resinTypeAverages: {},
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
    expect(resolveResinPricePerLiter(settings, ResinType.ESTANDAR)).toBe(
      35000,
    );
  });
});
