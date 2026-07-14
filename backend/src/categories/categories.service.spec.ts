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
});
