import {
  removeFromCollection,
  replaceInCollection,
} from './store-collection.util';

describe('store-collection.util', () => {
  it('reemplaza o inserta por id', () => {
    const items = [{ id: 'a', value: 1 }];
    replaceInCollection(items, 'a', { id: 'a', value: 2 });
    expect(items[0].value).toBe(2);

    replaceInCollection(items, 'b', { id: 'b', value: 3 });
    expect(items).toHaveLength(2);
  });

  it('elimina por id', () => {
    const items = [{ id: 'a' }, { id: 'b' }];
    expect(removeFromCollection(items, 'a')).toBe(true);
    expect(items).toHaveLength(1);
  });
});
