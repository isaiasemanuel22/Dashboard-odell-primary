import { FilamentType } from '../common/enums';
import { GeneralSettings } from '../common/interfaces';
import { calculateErrorMarginCost } from './cost-material.calc';
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

  it('redondea el margen de error sobre material, luz y máquina', () => {
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
  });
});
