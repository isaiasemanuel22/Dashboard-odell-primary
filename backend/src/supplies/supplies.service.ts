import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FilamentType,
  ResinType,
  SupplyType,
} from '../common/enums';
import { Supply } from '../common/interfaces';
import { CostCalculatorService } from '../settings/cost-calculator.service';
import { SupplyRepository } from '../store/repositories';

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

  findAll(type?: SupplyType): Supply[] {
    return this.supplies.findAll(type);
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
    this.validateSupply(data);
    return this.supplies.create(data);
  }

  update(id: string, data: Partial<Omit<Supply, 'id'>>): Supply {
    const existing = this.findOne(id);
    const merged = { ...existing, ...data };
    this.validateSupply(merged);

    if (
      merged.type === SupplyType.FILAMENTO &&
      data.unitPrice !== undefined &&
      data.unitPrice !== existing.unitPrice
    ) {
      merged.priceFromSettings = false;
    }

    merged.updatedAt = new Date().toISOString();
    return this.supplies.save(merged as Supply);
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
}
