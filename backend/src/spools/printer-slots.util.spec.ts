import { SupplyCategory } from '../common/enums';
import { printerSlotsApi } from './printer-slots.util';

describe('printerSlotsApi', () => {
  it('deriva AMS de bobinas abiertas', () => {
    const colors = [{ id: 'color-1', name: 'Negro', hex: '#111111' }];
    const supplies = [
      {
        id: 'sup-1',
        name: 'PLA',
        category: SupplyCategory.FDM,
        unit: 'kg',
        quantity: 1,
        minStock: 0,
        unitPrice: 1,
        priceFromSettings: false,
        colorId: 'color-1',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    const spools = [
      {
        id: 'spl-1',
        code: 'B-01',
        supplyId: 'sup-1',
        initialGrams: 1000,
        remainingGrams: 400,
        location: { kind: 'printer' as const, printerId: 'mp-1', slot: 2 },
        openedAt: '2026-01-01T00:00:00.000Z',
        finishedAt: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    const slots = printerSlotsApi('mp-1', spools, supplies, colors);
    expect(slots).toHaveLength(4);
    expect(slots[0]).toEqual({
      slot: 1,
      spoolId: null,
      code: null,
      color: null,
      remainingGrams: null,
    });
    expect(slots[1]).toEqual({
      slot: 2,
      spoolId: 'spl-1',
      code: 'B-01',
      color: { id: 'color-1', name: 'Negro', hex: '#111111' },
      remainingGrams: 400,
    });
  });
});
