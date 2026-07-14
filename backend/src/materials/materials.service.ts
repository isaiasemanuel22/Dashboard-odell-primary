import { Injectable, NotFoundException } from '@nestjs/common';
import { Material } from '../common/interfaces';
import { assertNonNegativeNumber } from '../common/validators/domain.validators';
import { MaterialRepository } from '../store/repositories';

@Injectable()
export class MaterialsService {
  constructor(private readonly materials: MaterialRepository) {}

  findAll(): Material[] {
    return this.materials.findAll();
  }

  findLowStock(): Material[] {
    return this.materials.findLowStock();
  }

  findOne(id: string): Material {
    const material = this.materials.findById(id);
    if (!material) {
      throw new NotFoundException(`Material ${id} no encontrado`);
    }
    return material;
  }

  update(id: string, data: Partial<Omit<Material, 'id'>>): Material {
    const existing = this.materials.findById(id);
    if (!existing) {
      throw new NotFoundException(`Material ${id} no encontrado`);
    }
    if (data.quantity !== undefined) {
      assertNonNegativeNumber(data.quantity, 'quantity');
    }
    if (data.minStock !== undefined) {
      assertNonNegativeNumber(data.minStock, 'minStock');
    }
    return this.materials.save({ ...existing, ...data });
  }
}
