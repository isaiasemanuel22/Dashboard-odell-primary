import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FilamentType,
  ResinType,
  SupplyCategory,
  SupplyType,
} from '../common/enums';
import { Supply } from '../common/interfaces';
import { CostCalculatorService } from '../settings/cost-calculator.service';
import { SupplyRepository } from '../store/repositories';
import {
  inferSupplyCategory,
} from './supply-category.util';

const SUPPLY_UNITS: Record<SupplyType, string> = {
  [SupplyType.FILAMENTO]: 'kg',
  [SupplyType.RESINA]: 'L',
  [SupplyType.ALCOHOL]: 'L',
  [SupplyType.TINTA]: 'ml',
  [SupplyType.REMERA]: 'unidad',
  [SupplyType.TAZA]: 'unidad',
  [SupplyType.BUZO]: 'unidad',
  [SupplyType.GORRA]: 'unidad',
  [SupplyType.FILM]: 'hoja',
  [SupplyType.VINILO]: 'm',
  [SupplyType.OTRO]: 'unidad',
};

@Injectable()
export class SuppliesService {
  constructor(
    private readonly supplies: SupplyRepository,
    private readonly costCalculator: CostCalculatorService,
  ) {}

  findAll(type?: SupplyType, category?: SupplyCategory): Supply[] {
    let items = this.supplies.findAll(type);
    if (category) {
      items = items.filter((supply) => supply.category === category);
    }
    return items;
  }

  findLowStock(): Supply[] {
    return this.supplies.findLowStock();
  }

  findOne(id: string): Supply {
    const supply = this.supplies.findById(id);
    if (!supply) {
      throw new NotFoundException(`Insumo ${id} no encontrado`);
    }
    return supply;
  }

  resolveDefaultPrice(data: {
    type: SupplyType;
    brand?: string;
    filamentType?: FilamentType;
    resinType?: ResinType;
  }) {
    return this.costCalculator.getUnitPriceForSupply(
      data.type,
      data.brand,
      data.filamentType,
      data.resinType,
    );
  }

  create(data: Omit<Supply, 'id' | 'updatedAt'>): Supply {
    const normalized = this.normalizeSupply(data);
    this.validateSupply(normalized);
    return this.supplies.create(normalized);
  }

  update(id: string, data: Partial<Omit<Supply, 'id'>>): Supply {
    const existing = this.findOne(id);
    const merged = this.normalizeSupply({ ...existing, ...data });
    this.validateSupply(merged);

    if (
      merged.type === SupplyType.FILAMENTO &&
      data.unitPrice !== undefined &&
      data.unitPrice !== existing.unitPrice
    ) {
      merged.priceFromSettings = false;
    }

    return this.supplies.save({
      ...merged,
      id: existing.id,
      updatedAt: new Date().toISOString(),
    } as Supply);
  }

  remove(id: string): void {
    if (!this.supplies.findById(id)) {
      throw new NotFoundException(`Insumo ${id} no encontrado`);
    }
    this.supplies.remove(id);
  }

  private validateSupply(data: Partial<Supply>): void {
    if (!data.name?.trim()) {
      throw new BadRequestException('El nombre es obligatorio');
    }
    if (!data.type || !Object.values(SupplyType).includes(data.type)) {
      throw new BadRequestException('Tipo de insumo inválido');
    }
    if (data.quantity !== undefined && Number(data.quantity) < 0) {
      throw new BadRequestException('La cantidad no puede ser negativa');
    }
    if (data.type === SupplyType.FILAMENTO && !data.filamentType) {
      throw new BadRequestException('Seleccioná el tipo de filamento');
    }
    if (data.type === SupplyType.RESINA && !data.resinType) {
      throw new BadRequestException('Seleccioná el tipo de resina');
    }
    if (
      (data.type === SupplyType.FILAMENTO || data.type === SupplyType.RESINA) &&
      !data.brand?.trim()
    ) {
      throw new BadRequestException('La marca es obligatoria');
    }
    if (data.unitPrice !== undefined && Number(data.unitPrice) < 0) {
      throw new BadRequestException('El precio no puede ser negativo');
    }
    if (!data.unit) {
      data.unit = SUPPLY_UNITS[data.type];
    }
  }

  private normalizeSupply(
    data: Partial<Supply> & Pick<Supply, 'name' | 'type'>,
  ): Omit<Supply, 'id' | 'updatedAt'> {
    const category =
      data.category && Object.values(SupplyCategory).includes(data.category)
        ? data.category
        : inferSupplyCategory(data.type);
    return {
      name: data.name.trim(),
      category,
      type: data.type,
      filamentType: data.filamentType,
      resinType: data.resinType,
      brand: data.brand?.trim(),
      unit: data.unit ?? SUPPLY_UNITS[data.type],
      quantity: Number(data.quantity) || 0,
      minStock: Number(data.minStock) || 0,
      unitPrice: Number(data.unitPrice) || 0,
      priceFromSettings: data.priceFromSettings === true,
      supplier: data.supplier?.trim() || undefined,
    };
  }
}
