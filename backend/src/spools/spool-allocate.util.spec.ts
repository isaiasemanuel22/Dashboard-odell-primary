import { Spool } from '../common/interfaces';
import { allocateSpools } from './spool-allocate.util';

function spool(partial: Partial<Spool> & Pick<Spool, 'id' | 'code'>): Spool {
  return {
    supplyId: 'sup-1',
    initialGrams: 1000,
    remainingGrams: 1000,
    location: { kind: 'shelf', text: 'Estante' },
    openedAt: '2026-01-01T00:00:00.000Z',
    finishedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

describe('allocateSpools', () => {
  it('prioriza bobinas de la impresora del job', () => {
    const open = [
      spool({
        id: 'spl-1',
        code: 'B-01',
        remainingGrams: 200,
        location: { kind: 'shelf', text: 'A' },
      }),
      spool({
        id: 'spl-2',
        code: 'B-02',
        remainingGrams: 100,
        location: { kind: 'printer', printerId: 'mp-1', slot: 1 },
      }),
    ];
    const result = allocateSpools(open, 80, 'mp-1');
    expect(result.spools).toEqual([
      expect.objectContaining({
        spoolId: 'spl-2',
        grams: 80,
        remainingAfter: 20,
      }),
    ]);
    expect(result.closedGrams).toBe(0);
  });

  it('reparte entre varias bobinas y deja remanente en closed', () => {
    const open = [
      spool({ id: 'spl-1', code: 'B-01', remainingGrams: 30 }),
      spool({ id: 'spl-2', code: 'B-02', remainingGrams: 40 }),
    ];
    const result = allocateSpools(open, 100);
    expect(result.spools.map((p) => p.grams)).toEqual([30, 40]);
    expect(result.closedGrams).toBe(30);
  });

  it('sin bobinas → todo closedGrams', () => {
    const result = allocateSpools([], 50, 'mp-1');
    expect(result.spools).toEqual([]);
    expect(result.closedGrams).toBe(50);
  });

  it('bobina a 0 queda con remainingAfter 0', () => {
    const open = [spool({ id: 'spl-1', code: 'B-01', remainingGrams: 25 })];
    const result = allocateSpools(open, 25);
    expect(result.spools[0].remainingAfter).toBe(0);
    expect(result.closedGrams).toBe(0);
  });
});
