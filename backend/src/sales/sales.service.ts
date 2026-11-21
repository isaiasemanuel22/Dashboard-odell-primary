import {
  arStartOfDay,
  fromArLocal,
  toArParts,
} from '../common/utils/ar-date.util';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FairStatus,
  PaymentMethod,
  SaleSource,
  SalesChannel,
} from '../common/enums';
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
  FairRepository,
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
import {
  activePayments,
  collectedPaymentsCents,
  paymentFeeCents,
  toCents,
} from '../common/utils/money.util';
import {
  assertInvoiceNumberFree,
  buildSaleInvoice,
} from '../settings/integrations.util';
import { StoreService } from '../store/store.service';
import { defaultAccountForMethod } from '../treasury/treasury-account.util';
import { isRevenueOrder, resolveOrderSoldAt } from './sales-order.util';
import { calculateOrderLineSubtotal } from '../orders/order-pricing.util';
import {
  detectLossSale,
  resolveLossReason,
} from '../common/utils/loss-sale.util';
import { computeAreaProfitBalances } from './profit-area.util';

@Injectable()
export class SalesService {
  constructor(
    private readonly retailSales: RetailSaleRepository,
    private readonly orders: OrderRepository,
    private readonly products: ProductRepository,
    private readonly costCalculator: CostCalculatorService,
    private readonly fairs: FairRepository,
    private readonly store?: StoreService,
  ) {}

  getOverview(month?: string): SalesOverview {
    const reference = referenceFromMonth(month);
    const monthRange = getMonthRange(reference);
    const allEntries = this.buildEntries();
    const entries = allEntries.filter((entry) =>
      isDateInMonthRange(new Date(entry.soldAt), monthRange),
    );

    const stats = this.computeStats(entries);
    stats.last12MonthsInvoicedRevenue = last12MonthsInvoicedRevenue(
      allEntries,
      reference,
    );
    stats.annualInvoiceCap =
      this.store?.generalSettings.integrations?.arca?.annualCap ?? null;

    return { stats, entries };
  }

  /** Entradas de venta con economía ya calculada (un solo cálculo de costo). */
  listEntries(): SaleEntry[] {
    return this.buildEntries();
  }

  /** Costo unitario de una línea, mismo criterio que computeEntryEconomics. */
  resolveItemUnitCost(item: SaleEntryItem): number {
    return this.costCalculator.resolveOrderItemUnitCost(item);
  }

  /** Ingreso reconocido como venta (mostrador + pedidos entregados). */
  getTotalIncome(): number {
    return this.buildEntries().reduce((sum, entry) => sum + entry.total, 0);
  }

  /**
   * Dinero efectivamente cobrado para la Billetera:
   * ventas de mostrador y pagos/señas de pedidos, netos de comisión
   * (no el total al entregar).
   */
  getCollectedIncome(): number {
    const retailCents = this.retailSales
      .findAll()
      .reduce((sum, sale) => sum + toCents(sale.total) - toCents(sale.fee), 0);
    const orderPaymentsCents = this.orders
      .findAll()
      .reduce((sum, order) => sum + collectedPaymentsCents(order), 0);
    return (retailCents + orderPaymentsCents) / 100;
  }

  findRetailSale(id: string): RetailSale {
    const sale = this.retailSales.findById(id);
    if (!sale) {
      throw new NotFoundException(`Venta ${id} no encontrada`);
    }
    return sale;
  }

  createRetail(data: CreateRetailSaleDto): RetailSale {
    const fairId = data.fairId?.trim() || undefined;
    if (fairId) {
      const fair = this.fairs.findById(fairId);
      if (!fair) {
        throw new NotFoundException(`Feria ${fairId} no encontrada`);
      }
      if (fair.status !== FairStatus.OPEN) {
        throw new BadRequestException(
          fair.status === FairStatus.CLOSED
            ? 'La feria está cerrada: no se pueden cargar ventas'
            : 'La feria todavía no está abierta: abrila para cargar ventas',
        );
      }
    }
    const sale = this.buildRetailSale(data);
    this.applyRetailStockChange([], sale.items);
    return this.retailSales.create(sale);
  }

  updateRetail(id: string, data: UpdateRetailSaleDto): RetailSale {
    const current = this.retailSales.findById(id);
    if (!current) {
      throw new NotFoundException(`Venta ${id} no encontrada`);
    }

    this.assertFairAllowsChanges(current);

    const merged: CreateRetailSaleDto = {
      fairId: current.fairId,
      items:
        data.items ??
        current.items.map((item) => ({
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
      method: data.method ?? current.method,
      account: data.account ?? current.account,
      fee: data.fee !== undefined ? data.fee : current.fee,
      lossReason: data.lossReason ?? current.lossReason,
      lossReasonNote:
        data.lossReason !== undefined
          ? data.lossReasonNote
          : (data.lossReasonNote ?? current.lossReasonNote),
    };

    const updated = this.buildRetailSale(
      merged,
      id,
      current.createdAt,
      current.invoice,
    );
    this.applyRetailStockChange(current.items, updated.items);
    return this.retailSales.save(updated);
  }

  /** Marca la factura C de una venta de mostrador o de feria (aunque la feria esté cerrada). */
  markRetailInvoice(
    id: string,
    data: { number: string; issuedAt?: string },
  ): RetailSale {
    const sale = this.findRetailSale(id);
    const invoice = buildSaleInvoice(data.number, data.issuedAt);
    assertInvoiceNumberFree(
      invoice.number,
      this.orders.findAll(),
      this.retailSales.findAll(),
      { retailSaleId: sale.id },
    );
    sale.invoice = invoice;
    return this.retailSales.save(sale);
  }

  removeRetailInvoice(id: string): RetailSale {
    const sale = this.findRetailSale(id);
    if (!sale.invoice) {
      throw new BadRequestException('La venta no tiene factura marcada');
    }
    sale.invoice = undefined;
    return this.retailSales.save(sale);
  }

  removeRetail(id: string): void {
    const sale = this.retailSales.findById(id);
    if (!sale) {
      throw new NotFoundException(`Venta ${id} no encontrada`);
    }
    this.assertFairAllowsChanges(sale);
    this.applyRetailStockChange(sale.items, []);
    this.retailSales.remove(id);
  }

  /** Las ventas de una feria cerrada no se editan ni se borran (§26). */
  private assertFairAllowsChanges(sale: RetailSale): void {
    if (!sale.fairId) return;
    const fair = this.fairs.findById(sale.fairId);
    if (fair?.status === FairStatus.CLOSED) {
      throw new BadRequestException(
        'La feria está cerrada: sus ventas no se pueden editar ni borrar',
      );
    }
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
    const fees = toCents(sale.fee) / 100;

    return {
      id: `retail-${sale.id}`,
      source: SaleSource.RETAIL,
      saleId: sale.id,
      customerName: sale.fairId
        ? fairOriginLabel(this.fairs.findById(sale.fairId)?.name)
        : 'Mostrador',
      items,
      total: sale.total,
      cost: economics.cost,
      profit: economics.profit,
      soldAt: sale.soldAt,
      notes: sale.notes,
      retailSaleId: sale.id,
      channel: sale.fairId ? SalesChannel.FERIA : SalesChannel.MOSTRADOR,
      fees,
      netProfit: roundCents(economics.profit - fees),
      paymentMethods: [sale.method ?? PaymentMethod.EFECTIVO],
      invoice: sale.invoice,
      fairId: sale.fairId,
      editable: true,
    };
  }

  private toOrderEntry(order: Order): SaleEntry {
    const items: SaleEntryItem[] = order.items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      // Mismo cálculo que el total del pedido: el diseño es precio cerrado.
      lineTotal: calculateOrderLineSubtotal(item),
      serviceType: item.serviceType,
      printTimeHours: item.printTimeHours,
      grams: item.grams,
      filamentType: item.filamentType,
      workTimeHours: item.workTimeHours,
      printProcess: item.printProcess,
      resinType: item.resinType,
      washMinutes: item.washMinutes,
      cureMinutes: item.cureMinutes,
    }));
    const economics = this.computeEntryEconomics(items, order.total);
    const payments = activePayments(order.payments);
    const fees =
      payments.reduce((sum, payment) => sum + paymentFeeCents(payment), 0) /
      100;
    const paymentMethods = [
      ...new Set(
        payments.map((payment) => payment.method ?? PaymentMethod.EFECTIVO),
      ),
    ];

    return {
      id: `order-${order.id}`,
      source: SaleSource.ORDER,
      saleId: order.id,
      customerName: order.customerName,
      items,
      total: order.total,
      cost: economics.cost,
      profit: economics.profit,
      soldAt: resolveOrderSoldAt(order),
      notes: order.description,
      orderId: order.id,
      salesChannel: order.salesChannel,
      channel: order.salesChannel ?? 'sin_canal',
      fees,
      netProfit: roundCents(economics.profit - fees),
      paymentMethods,
      invoice: order.invoice,
      editable: false,
    };
  }

  private computeEntryEconomics(
    items: SaleEntryItem[],
    total: number,
  ): { cost: number; profit: number } {
    const cost = items.reduce((sum, item) => {
      const unitCost = this.costCalculator.resolveOrderItemUnitCost(item);
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
    const monthlyRetailCost = retailEntries.reduce(
      (sum, entry) => sum + entry.cost,
      0,
    );
    const monthlyOrdersCost = orderEntries.reduce(
      (sum, entry) => sum + entry.cost,
      0,
    );
    const monthlyRetailProfit = retailEntries.reduce(
      (sum, entry) => sum + entry.profit,
      0,
    );
    const monthlyOrdersProfit = orderEntries.reduce(
      (sum, entry) => sum + entry.profit,
      0,
    );
    const monthlyFees = entries.reduce((sum, entry) => sum + entry.fees, 0);
    const monthlyRetailFees = retailEntries.reduce(
      (sum, entry) => sum + entry.fees,
      0,
    );
    const monthlyOrdersFees = orderEntries.reduce(
      (sum, entry) => sum + entry.fees,
      0,
    );
    const invoiced = entries.filter((entry) => entry.invoice);
    const uninvoiced = entries.filter((entry) => !entry.invoice);
    const sumTotal = (list: SaleEntry[]) =>
      list.reduce((sum, entry) => sum + entry.total, 0);
    const monthlyCost = monthlyRetailCost + monthlyOrdersCost;
    const monthlyProfit = monthlyRetailProfit + monthlyOrdersProfit;
    const profitByArea = computeAreaProfitBalances(
      entries,
      (item) => this.costCalculator.resolveOrderItemUnitCost(item),
      (productId) => this.products.findById(productId) ?? null,
    );

    return {
      monthlyRevenue: monthlyRetailRevenue + monthlyOrdersRevenue,
      monthlyCost,
      monthlyProfit,
      monthlyOrdersRevenue,
      monthlyRetailRevenue,
      monthlyOrdersCost,
      monthlyRetailCost,
      monthlyOrdersProfit,
      monthlyRetailProfit,
      monthlyOrdersCount: orderEntries.length,
      monthlyRetailCount: retailEntries.length,
      profitByArea,
      monthlyFees,
      monthlyRetailFees,
      monthlyOrdersFees,
      monthlyRetailNetProfit: roundCents(
        monthlyRetailProfit - monthlyRetailFees,
      ),
      monthlyOrdersNetProfit: roundCents(
        monthlyOrdersProfit - monthlyOrdersFees,
      ),
      monthlyNetProfit: roundCents(monthlyProfit - monthlyFees),
      invoicedRevenue: sumTotal(invoiced),
      invoicedCount: invoiced.length,
      uninvoicedRevenue: sumTotal(uninvoiced),
      uninvoicedCount: uninvoiced.length,
      last12MonthsInvoicedRevenue: 0,
      annualInvoiceCap: null,
    };
  }

  private buildRetailSale(
    data: CreateRetailSaleDto,
    id?: string,
    createdAt?: string,
    invoice?: RetailSale['invoice'],
  ): RetailSale {
    if (!data.items?.length) {
      throw new BadRequestException('Agregá al menos un producto al carrito');
    }

    const items = data.items.map((item) => this.buildRetailItem(item));
    const discount = normalizeDiscountFields(data);
    const subtotal = calculateItemsSubtotal(items);
    const total = calculateTotalWithDiscount(subtotal, discount);
    const now = new Date().toISOString();
    const method = data.method ?? PaymentMethod.EFECTIVO;
    const account = data.account ?? defaultAccountForMethod(method);
    // Venta a pérdida: exige motivo; sin pérdida se limpia (§16).
    const loss = detectLossSale(items, total, (item) =>
      this.costCalculator.resolveOrderItemUnitCost(item),
    );
    const lossFields = resolveLossReason(loss, data);
    const feeCents = toCents(data.fee ?? 0);
    if (feeCents < 0) {
      throw new BadRequestException('La comisión no puede ser negativa');
    }
    if (feeCents > toCents(total)) {
      throw new BadRequestException(
        'La comisión no puede superar el total de la venta',
      );
    }

    return {
      id: id ?? this.retailSales.nextId(),
      items,
      total,
      discountPercent: discount.discountPercent,
      discountAmount: discount.discountAmount,
      lossReason: lossFields.lossReason,
      lossReasonNote: lossFields.lossReasonNote,
      notes: data.notes?.trim() || undefined,
      method,
      account,
      fee: feeCents / 100,
      invoice,
      fairId: data.fairId?.trim() || undefined,
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

    const productId = data.productId?.trim() || undefined;
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

  private applyRetailStockChange(
    previous: RetailSaleItem[],
    next: RetailSaleItem[],
  ): void {
    const deltas = new Map<string, number>();
    for (const item of previous) {
      if (item.productId) {
        deltas.set(
          item.productId,
          (deltas.get(item.productId) ?? 0) + item.quantity,
        );
      }
    }
    for (const item of next) {
      if (item.productId) {
        deltas.set(
          item.productId,
          (deltas.get(item.productId) ?? 0) - item.quantity,
        );
      }
    }

    const sold = new Set(next.map((item) => item.productId));
    const apply: [
      NonNullable<ReturnType<ProductRepository['findById']>>,
      number,
    ][] = [];
    for (const [productId, delta] of deltas) {
      const product = this.products.findById(productId);
      if (!product) {
        // Al devolver stock de un producto ya eliminado no hay nada que
        // reponer; solo falla si se está vendiendo.
        if (sold.has(productId)) {
          throw new NotFoundException(`Producto ${productId} no encontrado`);
        }
        continue;
      }
      apply.push([product, delta]);
    }
    for (const [product, delta] of apply) {
      product.stock = Math.max(0, (product.stock ?? 0) + delta);
      this.products.save(product);
    }
  }
}

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Facturado cuyo `invoice.issuedAt` cae en los 12 meses que terminan al fin del
 * mes de `reference` (hora AR), sin importar la fecha de la venta.
 */
export function last12MonthsInvoicedRevenue(
  entries: SaleEntry[],
  reference: Date,
): number {
  const { year, month } = toArParts(reference);
  const range = {
    start: arStartOfDay(year, month - 11, 1),
    end: new Date(arStartOfDay(year, month + 1, 1).getTime() - 1),
  };
  return entries.reduce(
    (sum, entry) =>
      entry.invoice &&
      isDateInMonthRange(new Date(entry.invoice.issuedAt), range)
        ? sum + entry.total
        : sum,
    0,
  );
}

function referenceFromMonth(month?: string): Date {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return new Date();
  const [year, mon] = month.split('-').map(Number);
  if (!year || mon < 1 || mon > 12) return new Date();
  // Mediodía AR del día 15: cae en ese mes sin importar la zona del servidor.
  return fromArLocal(year, mon, 15, 12);
}

/** «Feria <nombre>», sin repetir el prefijo si el nombre ya empieza con «Feria». */
export function fairOriginLabel(name?: string): string {
  const trimmed = name?.trim() ?? '';
  if (!trimmed) return 'Feria';
  return /^feria\b/i.test(trimmed) ? trimmed : `Feria ${trimmed}`;
}
