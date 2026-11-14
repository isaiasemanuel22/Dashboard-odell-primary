import { FilamentType } from '../common/enums';
import { INDISTINTO_COLOR_ID } from '../common/color.util';
import { FdmFilamentLine } from '../common/interfaces';
import {
  distributePurgeGrams,
  normalizeFdmFilaments,
  totalFdmFilamentGrams,
} from './fdm-product.util';

describe('fdm-product.util', () => {
  it('normaliza líneas múltiples de filamento', () => {
    const lines: FdmFilamentLine[] = [
      { id: 'ff-1', filamentType: FilamentType.PLA, grams: 40 },
      { id: 'ff-2', filamentType: FilamentType.TPU, grams: 15 },
    ];

    expect(normalizeFdmFilaments(lines)).toEqual(
      lines.map((line) => ({ ...line, colorId: INDISTINTO_COLOR_ID })),
    );
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

  it('reparte la purga AMS en proporción a los gramos de cada fila', () => {
    expect(distributePurgeGrams([{ grams: 30 }, { grams: 70 }], 9)).toEqual([
      2.7, 6.3,
    ]);
    expect(distributePurgeGrams([{ grams: 10 }], 0)).toEqual([0]);
    expect(distributePurgeGrams([], 9)).toEqual([]);
  });
});
