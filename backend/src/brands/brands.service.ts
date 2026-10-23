import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BrandMaterialType } from '../common/enums';
import { Brand } from '../common/interfaces';
import {
  brandIsUsed,
  ensureBrand,
  findBrandByName,
  hydrateBrandNames,
} from '../store/brand-link.util';
import { StoreService } from '../store/store.service';

const MATERIAL_TYPES = new Set<string>(Object.values(BrandMaterialType));

@Injectable()
export class BrandsService {
  constructor(private readonly store: StoreService) {}

  findAll(materialType?: BrandMaterialType): Brand[] {
    const brands = this.store.brands ?? [];
    if (!materialType) return brands;
    return brands.filter((brand) => brand.materialTypes.includes(materialType));
  }

  findOne(id: string): Brand {
    const brand = (this.store.brands ?? []).find((entry) => entry.id === id);
    if (!brand) throw new NotFoundException(`Marca ${id} no encontrada`);
    return brand;
  }

  create(data: { name: string; materialTypes?: BrandMaterialType[] }): Brand {
    const types = this.normalizeTypes(data.materialTypes ?? []);
    const name = data.name?.trim();
    if (!name) throw new BadRequestException('El nombre es obligatorio');
    if (findBrandByName(this.store.brands ?? [], name)) {
      throw new BadRequestException('Ya existe una marca con ese nombre');
    }
    const created = ensureBrand(this.store, name, types[0]);
    if (types.length > 1) {
      created.materialTypes = types;
    }
    return created;
  }

  update(
    id: string,
    data: { name?: string; materialTypes?: BrandMaterialType[] },
  ): Brand {
    const brand = this.findOne(id);
    if (data.name !== undefined) {
      const name = data.name.trim();
      if (!name) throw new BadRequestException('El nombre es obligatorio');
      const duplicate = findBrandByName(this.store.brands ?? [], name);
      if (duplicate && duplicate.id !== id) {
        throw new BadRequestException('Ya existe una marca con ese nombre');
      }
      brand.name = name;
    }
    if (data.materialTypes !== undefined) {
      brand.materialTypes = this.normalizeTypes(data.materialTypes);
    }
    hydrateBrandNames(this.store);
    return brand;
  }

  remove(id: string): void {
    this.findOne(id);
    if (brandIsUsed(this.store.toState(), id)) {
      throw new BadRequestException(
        'No se puede eliminar: la marca está en uso',
      );
    }
    this.store.brands = (this.store.brands ?? []).filter(
      (brand) => brand.id !== id,
    );
  }

  private normalizeTypes(types: BrandMaterialType[]): BrandMaterialType[] {
    const unique = [...new Set(types)];
    if (unique.some((type) => !MATERIAL_TYPES.has(type))) {
      throw new BadRequestException('Tipo de material inválido');
    }
    return unique;
  }
}
