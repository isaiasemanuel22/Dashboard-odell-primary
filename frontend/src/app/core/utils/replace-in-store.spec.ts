import { removeById, upsertById } from './replace-in-store';

describe('replace-in-store', () => {
  it('upsertById inserta o reemplaza', () => {
    const initial = [{ id: '1', name: 'A' }];
    const updated = upsertById(initial, { id: '1', name: 'B' });
    expect(updated[0].name).toBe('B');

    const inserted = upsertById(updated, { id: '2', name: 'C' });
    expect(inserted.length).toBe(2);
  });

  it('removeById elimina del array', () => {
    const items = [{ id: '1' }, { id: '2' }];
    expect(removeById(items, '1').length).toBe(1);
  });
});
