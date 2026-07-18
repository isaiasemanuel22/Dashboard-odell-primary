import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SaleSource } from '../common/enums';
import {
  CreateRetailSaleDto,
  CreateRetailSaleItemDto,
  UpdateRetailSaleDto,
} from '../common/dto';
import {
  Order,
  RetailSale,
  RetailSaleItem,
  SaleEntry,
  SaleEntryItem,
  SalesOverview,
  SalesStats,
} from '../common/interfaces';
import {
  getMonthRange,
  isDateInMonthRange,
} from '../common/utils/month-range.util';
import {
  OrderRepository,
  ProductRepository,
  RetailSaleRepository,
} from '../store/repositories';
import { CostCalculatorService } from '../settings/cost-calculator.service';
import {
  calculateItemsSubtotal,
  calculateTotalWithDiscount,
  normalizeDiscountFields,
} from '../common/utils/discount.util';
import { isRevenueOrder } from './sales-order.util';

@Injectable()
export class SalesService {
  constructor(
    private readonly retailSales: RetailSaleRepository,
    private readonly orders: OrderRepository,
    private readonly products: ProductRepository,
    private readonly costCalculator: CostCalculatorService,
  ) {}

  getOverview(): SalesOverview {
    const monthRange = getMonthRange();
    const entries = this.buildEntries().filter((entry) =>
      isDateInMonthRange(new Date(entry.soldAt), monthRange),
    );

    return {
      stats: this.computeStats(entries),
      entries,
    };
  }

  findRetailSale(id: string): RetailSale {
    const sale = this.retailSales.findById(id);
    if (!sale) {
      throw new NotFoundException(`Venta ${id} no encontrada`);
    }
    return sale;
  }

  createRetail(data: CreateRetailSaleDto): RetailSale {
    const sale = this.buildRetailSale(data);
    return this.retailSales.create(sale);
  }

  updateRetail(id: string, data: UpdateRetailSaleDto): RetailSale {
    const current = this.retailSales.findById(id);
    if (!current) {
      throw new NotFoundException(`Venta ${id} no encontrada`);
    }

    const merged: CreateRetailSaleDto = {
      items: data.items ?? current.items.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
      notes: data.notes !== undefined ? data.notes : current.notes,
      soldAt: data.soldAt ?? current.soldAt,
      discountPercent:
        data.discountPercent !== undefined
          ? data.discountPercent
          : current.discountPercent,
      discountAmount:
        data.discountAmount !== undefined
          ? data.discountAmount
          : current.discountAmount,
    };

    const updated = this.buildRetailSale(merged, id, current.createdAt);
    return this.retailSales.save(updated);
  }

  removeRetail(id: string): void {
    if (!this.retailSales.findById(id)) {
      throw new NotFoundException(`Venta ${id} no encontrada`);
    }
    this.retailSales.remove(id);
  }

  private buildEntries(): SaleEntry[] {
    const retailEntries = this.retailSales
      .findAll()
      .map((sale) => this.toRetailEntry(sale));
    const orderEntries = this.orders
      .findAll()
      .filter((order) => isRevenueOrder(order))
      .map((order) => this.toOrderEntry(order));

    return [...retailEntries, ...orderEntries].sort(
      (a, b) => new Date(b.soldAt).getTime() - new Date(a.soldAt).getTime(),
    );
  }

  private toRetailEntry(sale: RetailSale): SaleEntry {
    const items = sale.items.map((item) => ({ ...item }));
    const economics = this.computeEntryEconomics(items, sale.total);

    return {
      id: `retail-${sale.id}`,
      source: SaleSource.RETAIL,
      saleId: sale.id,
      customerName: 'Mostrador',
      items,
      total: sale.total,
      cost: economics.cost,
      profit: economics.profit,
      soldAt: sale.soldAt,
      notes: sale.notes,
      retailSaleId: sale.id,
      editable: true,
    };
  }

  private toOrderEntry(order: Order): SaleEntry {
    const items: SaleEntryItem[] = order.items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.quantity * item.unitPrice,
    }));
    const economics = this.computeEntryEconomics(items, order.total);

    return {
      id: `order-${order.id}`,
      source: SaleSource.ORDER,
      saleId: order.id,
      customerName: order.customerName,
      items,
      total: order.total,
      cost: economics.cost,
      profit: economics.profit,
      soldAt: order.dueDate,
      notes: order.description,
      orderId: order.id,
      editable: false,
    };
  }

  private computeEntryEconomics(
    items: SaleEntryItem[],
    total: number,
  ): { cost: number; profit: number } {
    const cost = items.reduce((sum, item) => {
      const unitCost = item.productId
        ? this.costCalculator.resolveCatalogUnitCost(item.productId)
        : this.costCalculator.resolveDesignUnitCost(item.unitPrice);
      return sum + unitCost * item.quantity;
    }, 0);

    return {
      cost,
      profit: total - cost,
    };
  }

  private computeStats(entries: SaleEntry[]): SalesStats {
    const retailEntries = entries.filter(
      (entry) => entry.source === SaleSource.RETAIL,
    );
    const orderEntries = entries.filter(
      (entry) => entry.source === SaleSource.ORDER,
    );

    const monthlyRetailRevenue = retailEntries.reduce(
      (sum, entry) => sum + entry.total,
      0,
    );
    const monthlyOrdersRevenue = orderEntries.reduce(
      (sum, entry) => sum + entry.total,
      0,
    );
    const monthlyCost = entries.reduce((sum, entry) => sum + entry.cost, 0);
    const monthlyProfit = entries.reduce((sum, entry) => sum + entry.profit, 0);

    return {
      monthlyRevenue: monthlyRetailRevenue + monthlyOrdersRevenue,
      monthlyCost,
      monthlyProfit,
      monthlyOrdersRevenue,
      monthlyRetailRevenue,
      monthlyOrdersCount: orderEntries.length,
      monthlyRetailCount: retailEntries.length,
    };
  }

  private buildRetailSale(
    data: CreateRetailSaleDto,
    id?: string,
    createdAt?: string,
  ): RetailSale {
    if (!data.items?.length) {
      throw new BadRequestException('Agregá al menos un producto al carrito');
    }

    const items = data.items.map((item) => this.buildRetailItem(item));
    const discount = normalizeDiscountFields(data);
    const subtotal = calculateItemsSubtotal(items);
    const total = calculateTotalWithDiscount(subtotal, discount);
    const now = new Date().toISOString();

    return {
      id: id ?? this.retailSales.nextId(),
      items,
      total,
      discountPercent: discount.discountPercent,
      discountAmount: discount.discountAmount,
      notes: data.notes?.trim() || undefined,
      soldAt: data.soldAt ?? now,
      createdAt: createdAt ?? now,
    };
  }

  private buildRetailItem(data: CreateRetailSaleItemDto): RetailSaleItem {
    const quantity = Number(data.quantity);
    let unitPrice = Number(data.unitPrice);

    if (!quantity || quantity <= 0) {
      throw new BadRequestException('La cantidad debe ser mayor a cero');
    }

    let productId = data.productId?.trim() || undefined;
    let productName = data.productName?.trim() ?? '';

    if (productId) {
      const product = this.products.findById(productId);
      if (!product) {
        throw new NotFoundException(`Producto ${productId} no encontrado`);
      }
      unitPrice = this.costCalculator.resolveCatalogUnitPrice(productId);
      if (!productName) {
        productName = product.name;
      }
    }

    if (unitPrice < 0) {
      throw new BadRequestException('El precio unitario no puede ser negativo');
    }

    if (!productName) {
      throw new BadRequestException('Indicá el producto vendido');
    }

    return {
      productId,
      productName,
      quantity,
      unitPrice,
      lineTotal: quantity * unitPrice,
    };
  }
}
