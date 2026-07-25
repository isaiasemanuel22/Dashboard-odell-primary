import { FilamentType } from '../common/enums';
import { FdmFilamentLine } from '../common/interfaces';
import {
  createFdmFilamentLineId,
  normalizeFdmFilaments,
  totalFdmFilamentGrams,
} from './fdm-product.util';

describe('fdm-product.util', () => {
  it('normaliza líneas múltiples de filamento', () => {
    const lines: FdmFilamentLine[] = [
      { id: 'ff-1', filamentType: FilamentType.PLA, grams: 40 },
      { id: 'ff-2', filamentType: FilamentType.TPU, grams: 15 },
    ];

    expect(normalizeFdmFilaments(lines)).toEqual(lines);
    expect(totalFdmFilamentGrams(lines)).toBe(55);
  });

  it('migra grams + filamentType legacy a una línea', () => {
    const lines = normalizeFdmFilaments(undefined, {
      grams: 85,
      filamentType: FilamentType.PLA,
    });

    expect(lines).toHaveLength(1);
    expect(lines[0]?.grams).toBe(85);
    expect(lines[0]?.filamentType).toBe(FilamentType.PLA);
    expect(lines[0]?.id).toEqual(expect.any(String));
  });
});
