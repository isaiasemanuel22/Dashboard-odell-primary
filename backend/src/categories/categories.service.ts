import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProductType } from '../common/enums';
import { Category } from '../common/interfaces';
import { CategoryRepository } from '../store/repositories';

@Injectable()
export class CategoriesService {
  constructor(private readonly categories: CategoryRepository) {}

  findAll(type?: ProductType): Category[] {
    return this.categories.findAll(type);
  }

  findOne(id: string): Category {
    const category = this.categories.findById(id);
    if (!category) {
      throw new NotFoundException(`Categoría ${id} no encontrada`);
    }
    return category;
  }

  create(data: { name: string; productTypes: ProductType[] }): Category {
    const name = data.name?.trim();
    if (!name) {
      throw new BadRequestException('El nombre es obligatorio');
    }
    if (!data.productTypes?.length) {
      throw new BadRequestException(
        'Seleccioná al menos un tipo de producto',
      );
    }
    if (this.categories.nameExists(name)) {
      throw new BadRequestException('Ya existe una categoría con ese nombre');
    }
    return this.categories.create({ name, productTypes: data.productTypes });
  }

  remove(id: string): void {
    if (!this.categories.findById(id)) {
      throw new NotFoundException(`Categoría ${id} no encontrada`);
    }
    if (this.categories.isUsedByProducts(id)) {
      throw new BadRequestException(
        'No se puede eliminar: hay productos usando esta categoría',
      );
    }
    this.categories.remove(id);
  }
}
