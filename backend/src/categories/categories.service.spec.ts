import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProductType } from '../common/enums';
import { CategoryRepository } from '../store/repositories/category.repository';
import { StoreService } from '../store/store.service';
import { CategoriesService } from './categories.service';

describe('CategoriesService', () => {
  it('mantiene el índice del store al crear y eliminar', () => {
    const store = new StoreService();
    const repository = new CategoryRepository(store);
    const service = new CategoriesService(repository);

    const created = service.create({
      name: 'Accesorios',
      productTypes: [ProductType.FDM],
    });

    expect(store.getCategoryById(created.id)).toEqual(created);
    expect(store.categories).toHaveLength(1);

    service.remove(created.id);

    expect(store.getCategoryById(created.id)).toBeUndefined();
    expect(store.categories).toHaveLength(0);
  });

  it('renombra una categoría y rechaza nombres repetidos o vacíos', () => {
    const store = new StoreService();
    const service = new CategoriesService(new CategoryRepository(store));
    const a = service.create({ name: 'A', productTypes: [ProductType.FDM] });
    service.create({ name: 'B', productTypes: [ProductType.FDM] });

    expect(service.update(a.id, { name: ' Nueva ' }).name).toBe('Nueva');
    expect(store.getCategoryById(a.id)?.name).toBe('Nueva');
    expect(service.update(a.id, { name: 'nueva' }).name).toBe('nueva');
    expect(() => service.update(a.id, { name: 'b' })).toThrow(
      BadRequestException,
    );
    expect(() => service.update(a.id, { name: '  ' })).toThrow(
      BadRequestException,
    );
    expect(() => service.update('cat-999', { name: 'X' })).toThrow(
      NotFoundException,
    );
  });
});
