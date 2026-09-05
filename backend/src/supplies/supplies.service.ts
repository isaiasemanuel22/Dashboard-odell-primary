import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FilamentType,
  ResinType,
  SupplyCategory,
} from '../common/enums';
import { Supply } from '../common/interfaces';
import {
  supplyRequiresColor,
  validateSupplyColorId,
} from '../common/color.util';
import { CostCalculatorService } from '../settings/cost-calculator.service';
import { StoreChangeService } from '../store/store-change.service';
import { StoreService } from '../store/store.service';
import { SupplyRepository } from '../store/repositories';
import { OrderTasksService } from '../print-jobs/order-tasks.service';
import {
  defaultSupplyUnit,
  normalizeSupplyCategory,
} from './supply-category.util';

@Injectable()
export class SuppliesService {
  constructor(
    private readonly supplies: SupplyRepository,
    private readonly store: StoreService,
    private readonly costCalculator: CostCalculatorService,
    private readonly storeChange: StoreChangeService,
    private readonly orderTasks: OrderTasksService,
  ) {}

  findAll(category?: SupplyCategory): Supply[] {
    return this.supplies.findAll(category);
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
    category: SupplyCategory;
    brand?: string;
    filamentType?: FilamentType;
    resinType?: ResinType;
  }) {
    return this.costCalculator.getUnitPriceForSupply(
      data.category,
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
      merged.category === SupplyCategory.FDM &&
      data.unitPrice !== undefined &&
      data.unitPrice !== existing.unitPrice
    ) {
      merged.priceFromSettings = false;
    }

    const saved = this.supplies.save({
      ...merged,
      id: existing.id,
      updatedAt: new Date().toISOString(),
    } as Supply);

    if (
      data.unitPrice !== undefined &&
      Number(data.unitPrice) !== Number(existing.unitPrice)
    ) {
      this.storeChange.recordChange({
        collections: ['supplies'],
        realtime: {
          scopes: ['supplies'],
          action: 'update',
          entity: 'settings',
        },
      });
    }

    if (
      data.quantity !== undefined &&
      Number(data.quantity) > Number(existing.quantity)
    ) {
      this.orderTasks.notifySupplyAvailability();
    }

    return saved;
  }

  increaseStock(supplyId: string, delta: number): Supply {
    return this.recordPurchase(supplyId, { quantityDelta: delta });
  }

  recordPurchase(
    supplyId: string,
    data: { quantityDelta: number; unitPrice?: number },
    options: { persist?: boolean; notify?: boolean } = {},
  ): Supply {
    const persist = options.persist !== false;
    const notify = options.notify !== false;
    const delta = Number(data.quantityDelta);
    if (!Number.isFinite(delta) || delta <= 0) {
      throw new BadRequestException('La cantidad debe ser mayor a cero');
    }

    const existing = this.findOne(supplyId);
    const nextQuantity = Number(existing.quantity) + delta;
    const unitPrice =
      data.unitPrice !== undefined ? Number(data.unitPrice) : undefined;
    const unitPriceChanged =
      unitPrice !== undefined &&
      Math.round(unitPrice) !== Math.round(Number(existing.unitPrice));

    const saved = this.supplies.save({
      ...existing,
      quantity: nextQuantity,
      ...(unitPriceChanged
        ? { unitPrice, priceFromSettings: false }
        : {}),
      updatedAt: new Date().toISOString(),
    });

    if (persist) {
      this.storeChange.recordChange({
        collections: ['supplies'],
        realtime: {
          scopes: ['supplies', 'print-jobs', 'dashboard'],
          action: 'update',
          entity: 'supply',
          id: supplyId,
        },
      });
    }

    if (notify) {
      this.orderTasks.notifySupplyAvailability();
    }

    return saved;
  }

  notifySupplyAvailability(): void {
    this.orderTasks.notifySupplyAvailability();
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

    const category = normalizeSupplyCategory(data.category);
    if (data.quantity !== undefined && Number(data.quantity) < 0) {
      throw new BadRequestException('La cantidad no puede ser negativa');
    }
    if (category === SupplyCategory.FDM && !data.filamentType) {
      throw new BadRequestException('Seleccioná el tipo de filamento');
    }
    if (
      category === SupplyCategory.RESINA &&
      data.resinType &&
      !data.brand?.trim()
    ) {
      throw new BadRequestException('La marca es obligatoria');
    }
    if (
      category === SupplyCategory.FDM &&
      !data.brand?.trim()
    ) {
      throw new BadRequestException('La marca es obligatoria');
    }
    if (data.unitPrice !== undefined && Number(data.unitPrice) < 0) {
      throw new BadRequestException('El precio no puede ser negativo');
    }
    if (!data.unit) {
      data.unit = defaultSupplyUnit(category);
    }
    if (supplyRequiresColor(category)) {
      validateSupplyColorId(
        this.store.generalSettings.colors ?? [],
        data.colorId,
        true,
      );
    }
  }

  private normalizeSupply(
    data: Partial<Supply> & Pick<Supply, 'name'>,
  ): Omit<Supply, 'id' | 'updatedAt'> {
    const category = normalizeSupplyCategory(data.category);
    return {
      name: data.name.trim(),
      category,
      filamentType: data.filamentType,
      resinType: data.resinType,
      brand: data.brand?.trim(),
      unit: data.unit ?? defaultSupplyUnit(category),
      quantity: Number(data.quantity) || 0,
      minStock: Number(data.minStock) || 0,
      unitPrice: Number(data.unitPrice) || 0,
      priceFromSettings: data.priceFromSettings === true,
      supplier: data.supplier?.trim() || undefined,
      colorId: data.colorId,
    };
  }
}
