import {
  bestTwoHourWindow,
  normalizeFairName,
  unitsToPrint,
  unitsToTake,
} from './fairs.util';

describe('fairs.util', () => {
  it('unitsToTake: max(ceil(prom × 1,2), ceil(prom) + 1)', () => {
    expect(unitsToTake(0)).toBe(0);
    expect(unitsToTake(1)).toBe(2); // ceil(1,2)=2, 1+1=2
    expect(unitsToTake(5)).toBe(6); // 6 vs 6
    expect(unitsToTake(10)).toBe(12); // 12 vs 11
    expect(unitsToTake(0.33)).toBe(2); // ceil(0,4)=1 vs 1+1
    expect(unitsToTake(7.3)).toBe(9); // ceil(8,76)=9 vs 8+1
  });

  it('unitsToPrint no baja de cero', () => {
    expect(unitsToPrint(6, 2)).toBe(4);
    expect(unitsToPrint(6, 10)).toBe(0);
  });

  it('franja de 2 h en hora de Argentina', () => {
    // 18:30 y 19:10 AR (21:30 y 22:10 UTC) caen en 18-20; 10:00 AR en 10-12.
    const window = bestTwoHourWindow([
      '2026-11-17T21:30:00.000Z',
      '2026-11-17T22:10:00.000Z',
      '2026-11-17T13:00:00.000Z',
    ]);
    expect(window).toEqual({ from: '18:00', to: '20:00', count: 2 });
    expect(bestTwoHourWindow([])).toBeNull();
  });

  it('normaliza nombres sin distinguir mayúsculas', () => {
    expect(normalizeFairName('  Feria  PLAZA ')).toBe('feria plaza');
  });
});
