import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FilamentType, ResinType, SupplyCategory } from '../common/enums';
import { Supply } from '../common/interfaces';
import {
  supplyRequiresColor,
  validateSupplyColorId,
} from '../common/color.util';
import { CostCalculatorService } from '../settings/cost-calculator.service';
import { PricingSyncService } from '../pricing/pricing-sync.service';
import { StoreChangeService } from '../store/store-change.service';
import { assignSupplyBrand } from '../store/brand-link.util';
import { StoreService } from '../store/store.service';
import { SupplyRepository } from '../store/repositories';
import { OrderTasksService } from '../print-jobs/order-tasks.service';
import { countProductsUsingSupply } from './supply-affected-products.util';
import {
  appendSupplyPriceHistory,
  normalizeSupplyPriceHistory,
} from './supply-price-history.util';
import {
  defaultSupplyUnit,
  normalizeSupplyCategory,
} from './supply-category.util';

export interface SupplyPriceChangeRow {
  supplyId: string;
  name: string;
  unit: string;
  priceBefore: number;
  priceNow: number;
  variationPercent: number;
  affectedProducts: number;
}

@Injectable()
export class SuppliesService {
  constructor(
    private readonly supplies: SupplyRepository,
    private readonly store: StoreService,
    private readonly costCalculator: CostCalculatorService,
    private readonly storeChange: StoreChangeService,
    private readonly orderTasks: OrderTasksService,
    private readonly pricingSync: PricingSyncService,
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
    const unitPrice = Number(normalized.unitPrice) || 0;
    return this.supplies.create({
      ...normalized,
      priceHistory: appendSupplyPriceHistory([], unitPrice),
    });
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

    const unitPriceChanged =
      data.unitPrice !== undefined &&
      Number(data.unitPrice) !== Number(existing.unitPrice);

    const priceHistory = unitPriceChanged
      ? appendSupplyPriceHistory(
          existing.priceHistory,
          Number(merged.unitPrice) || 0,
        )
      : normalizeSupplyPriceHistory(existing.priceHistory);

    const saved = this.supplies.save({
      ...merged,
      id: existing.id,
      priceHistory,
      updatedAt: new Date().toISOString(),
    });

    if (unitPriceChanged) {
      this.storeChange.recordChange({
        collections: ['supplies'],
        realtime: {
          scopes: ['supplies'],
          action: 'update',
          entity: 'settings',
        },
      });
      this.pricingSync.syncAllProductsAndOrders('supply_price');
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

    const priceHistory = unitPriceChanged
      ? appendSupplyPriceHistory(existing.priceHistory, unitPrice)
      : normalizeSupplyPriceHistory(existing.priceHistory);

    const saved = this.supplies.save({
      ...existing,
      quantity: nextQuantity,
      ...(unitPriceChanged ? { unitPrice, priceFromSettings: false } : {}),
      priceHistory,
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

    if (unitPriceChanged && persist) {
      this.pricingSync.syncAllProductsAndOrders('supply_price');
    }

    return saved;
  }

  notifySupplyAvailability(): void {
    this.orderTasks.notifySupplyAvailability();
  }

  getPriceChanges(days = 90): SupplyPriceChangeRow[] {
    const safeDays = Math.min(Math.max(Math.trunc(Number(days) || 90), 1), 365);
    const periodStartMs = Date.now() - safeDays * 24 * 60 * 60 * 1000;
    const rows: SupplyPriceChangeRow[] = [];

    for (const supply of this.store.supplies) {
      const history = normalizeSupplyPriceHistory(supply.priceHistory);
      if (!history.length) continue;

      const priceBefore = this.resolvePriceBefore(history, periodStartMs);
      if (priceBefore == null) continue;

      const priceNow = Number(supply.unitPrice) || 0;
      if (Math.round(priceBefore) === Math.round(priceNow)) continue;

      const variationPercent =
        priceBefore === 0
          ? priceNow === 0
            ? 0
            : 100
          : ((priceNow - priceBefore) / priceBefore) * 100;

      if (variationPercent === 0) continue;

      const changedInPeriod = history.some(
        (entry) => new Date(entry.at).getTime() >= periodStartMs,
      );
      if (!changedInPeriod) continue;

      rows.push({
        supplyId: supply.id,
        name: supply.name,
        unit: supply.unit,
        priceBefore,
        priceNow,
        variationPercent,
        affectedProducts: countProductsUsingSupply(
          this.store.products,
          supply,
          this.store.generalSettings,
        ),
      });
    }

    return rows.sort(
      (a, b) => Math.abs(b.variationPercent) - Math.abs(a.variationPercent),
    );
  }

  remove(id: string): void {
    if (!this.supplies.findById(id)) {
      throw new NotFoundException(`Insumo ${id} no encontrado`);
    }
    this.supplies.remove(id);
  }

  private resolvePriceBefore(
    history: { at: string; unitPrice: number }[],
    periodStartMs: number,
  ): number | null {
    let before: number | null = null;
    for (const entry of history) {
      const atMs = new Date(entry.at).getTime();
      if (!Number.isFinite(atMs)) continue;
      if (atMs <= periodStartMs) {
        before = entry.unitPrice;
        continue;
      }
      if (before == null) {
        return entry.unitPrice;
      }
      break;
    }
    return before;
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
      !data.brand?.trim() &&
      !data.brandId
    ) {
      throw new BadRequestException('La marca es obligatoria');
    }
    if (
      category === SupplyCategory.FDM &&
      !data.brand?.trim() &&
      !data.brandId
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
    const supply = {
      name: data.name.trim(),
      category,
      filamentType: data.filamentType,
      resinType: data.resinType,
      brandId: data.brandId,
      brand: data.brand?.trim(),
      unit: data.unit ?? defaultSupplyUnit(category),
      quantity: Number(data.quantity) || 0,
      minStock: Number(data.minStock) || 0,
      unitPrice: Number(data.unitPrice) || 0,
      priceFromSettings: data.priceFromSettings === true,
      supplier: data.supplier?.trim() || undefined,
      colorId: data.colorId,
      priceHistory: normalizeSupplyPriceHistory(data.priceHistory),
    };
    assignSupplyBrand(this.store, supply as Supply);
    return supply;
  }
}
