import { FilamentType } from '../../core/models';
import { GeneralSettings } from '../../core/models';
import { averageFilamentPriceByType } from './material-type-price.util';
import { calculateErrorMarginCost } from './pricing.util';

/**
 * Misma tabla que `backend/src/settings/cost-material.parity.spec.ts`.
 * No une los motores: fija los dos cálculos que hoy coinciden.
 */
describe('paridad de costo con el API', () => {
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
    expect(calculateErrorMarginCost(100, 20, 30, 10)).toBe(15);
    expect(calculateErrorMarginCost(100, 20, 30, 0)).toBe(0);
    expect(calculateErrorMarginCost(100, 20, 30, 150)).toBe(150);
    expect(calculateErrorMarginCost(10, 0, 0, 33)).toBe(3);
  });
});
