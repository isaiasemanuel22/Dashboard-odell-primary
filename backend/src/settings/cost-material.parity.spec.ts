import { FilamentType, SupplyCategory } from '../common/enums';
import { GeneralSettings, Supply } from '../common/interfaces';
import {
  calcFilamentCost,
  calcPurgeCost,
  calculateErrorMarginCost,
} from './cost-material.calc';
import { averageFilamentPriceByType } from './material-type-price.util';

/**
 * Misma tabla que `frontend/src/app/shared/utils/cost-parity.spec.ts`.
 * No une los motores: fija los dos cálculos que hoy coinciden.
 */
describe('paridad de costo con el cliente', () => {
  it('promedia el precio por kilo del mismo tipo', () => {
    const settings = {
      filamentPrices: [
        { materialType: FilamentType.PLA, pricePerKg: 10000 },
        { materialType: FilamentType.PLA, pricePerKg: 30000 },
        { materialType: FilamentType.ABS, pricePerKg: 99999 },
      ],
    } as GeneralSettings;

    expect(averageFilamentPriceByType(settings, FilamentType.PLA)).toBe(20000);
    expect(averageFilamentPriceByType(settings, FilamentType.PETG)).toBeNull();
  });

  it('redondea el margen de error sobre material, luz, máquina y purga', () => {
    const margin = (percent: number) =>
      calculateErrorMarginCost(100, 20, 30, {
        errorMarginPercent: percent,
      } as GeneralSettings);

    expect(margin(10)).toBe(15);
    expect(
      calculateErrorMarginCost(100, 20, 30, {
        errorMarginPercent: 0,
      } as GeneralSettings),
    ).toBe(0);
    expect(
      calculateErrorMarginCost(100, 20, 30, {
        errorMarginPercent: 150,
      } as GeneralSettings),
    ).toBe(150);
    expect(
      calculateErrorMarginCost(10, 0, 0, {
        errorMarginPercent: 33,
      } as GeneralSettings),
    ).toBe(3);
    expect(
      calculateErrorMarginCost(
        100,
        20,
        30,
        {
          errorMarginPercent: 10,
        } as GeneralSettings,
        50,
      ),
    ).toBe(20);
  });

  it('calcula purga AMS con promedio simple de precios por fila', () => {
    const settings = {
      filamentTypeAverages: {
        [FilamentType.PLA]: 20000,
        [FilamentType.PETG]: 14000,
      },
    } as GeneralSettings;

    // 9 g × ((20000+14000)/2) / 1000 = 9 × 17 = 153
    expect(
      calcPurgeCost(
        9,
        {
          filaments: [
            { id: 'a', filamentType: FilamentType.PLA, grams: 30 },
            { id: 'b', filamentType: FilamentType.PETG, grams: 70 },
          ],
        },
        settings,
        [],
      ),
    ).toBe(153);

    expect(
      calcPurgeCost(0, { filamentType: FilamentType.PLA }, settings, []),
    ).toBe(0);
    expect(
      calcPurgeCost(null, { filamentType: FilamentType.PLA }, settings, []),
    ).toBe(0);
    expect(
      calcPurgeCost(10, { filamentType: FilamentType.PLA }, settings, []),
    ).toBe(200);
  });

  it('costea con el promedio de Insumos y cae a Ajustes sin precio (paridad con el cliente)', () => {
    const settings = {
      filamentTypeAverages: { [FilamentType.PLA]: 10036 },
    } as unknown as GeneralSettings;
    const supplies = [
      {
        category: SupplyCategory.FDM,
        filamentType: FilamentType.PLA,
        unit: 'kg',
        unitPrice: 5000,
      },
      {
        category: SupplyCategory.FDM,
        filamentType: FilamentType.PLA,
        unit: 'g',
        unitPrice: 7,
      },
      {
        category: SupplyCategory.FDM,
        filamentType: FilamentType.PLA,
        unit: 'kg',
        unitPrice: 0,
      },
    ] as unknown as Supply[];

    // (5000 + 7×1000) / 2 = 6000 $/kg → 100 g = 600
    expect(calcFilamentCost(FilamentType.PLA, 100, settings, supplies)).toBe(
      600,
    );
    // Sin insumos del tipo: respaldo de Ajustes.
    expect(calcFilamentCost(FilamentType.PLA, 100, settings, [])).toBeCloseTo(
      1003.6,
    );
  });
});
