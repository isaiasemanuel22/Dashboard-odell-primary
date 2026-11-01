import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CustomerType,
  OrderStatus,
  PaymentMethod,
  PriceType,
  PrintJobStatus,
  SalesChannel,
  ServiceType,
  TaskType,
  TreasuryAccount,
} from '../common/enums';
import {
  Customer,
  Order,
  OrderDeliveryLine,
  OrderItem,
  OrderOverview,
} from '../common/interfaces';
import { CreateOrderDto, UpdateOrderDto } from '../common/dto';
import {
  calculateTotalWithDiscount,
  normalizeDiscountFields,
} from '../common/utils/discount.util';
import { outstandingCents, toCents } from '../common/utils/money.util';
import { defaultAccountForMethod } from '../treasury/treasury-account.util';
import { calculateOrderItemsSubtotal } from './order-pricing.util';
import {
  DUE_DATE_AFTER_TODAY_MESSAGE,
  isDueDateAfterToday,
} from './due-date.util';
import { appendOrderPriceHistory } from './order-price-history.util';
import {
  listOrderPriceNotices,
  rememberKeptLinePrice,
} from './order-price-notice.util';
import { filterOrders, OrderListFilters } from './order-filter.util';
import { normalizeIncomingOrderItems } from './order-items.normalizer';
import { appendOrderStatusHistory } from './order-status-history.util';
import { isDesignPrintConfigured } from './design-print.util';
import { applyWholesalePricing } from './wholesale-pricing.util';
import { OrderTasksService } from '../print-jobs/order-tasks.service';
import { PrintJobsService } from '../print-jobs/print-jobs.service';
import { CostCalculatorService } from '../settings/cost-calculator.service';
import { normalizeWholesaleDiscount } from '../settings/wholesale-discount.util';
import {
  CustomerRepository,
  OrderRepository,
  ProductRepository,
} from '../store/repositories';
import { StoreService } from '../store/store.service';
import {
  ORDER_RICH_TEXT_MAX_LENGTH,
  hasRichTextContent,
  plainTextFromHtml,
  sanitizeRichTextHtml,
} from './rich-text.util';

@Injectable()
export class OrdersService {
  constructor(
    private readonly orders: OrderRepository,
    private readonly customers: CustomerRepository,
    private readonly products: ProductRepository,
    private readonly orderTasks: OrderTasksService,
    private readonly printJobs: PrintJobsService,
    private readonly costCalculator: CostCalculatorService,
    private readonly store: StoreService,
  ) {}

  findAll(filters: OrderListFilters = {}): Order[] {
    const orders = filterOrders([...this.orders.findAll()], filters);
    return orders.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  findOne(id: string): Order {
    const order = this.orders.findById(id);
    if (!order) {
      throw new NotFoundException(`Pedido ${id} no encontrado`);
    }
    return order;
  }

  getOverview(id: string): OrderOverview {
    const order = this.findOne(id);

    return {
      order,
      tasks: this.printJobs.findByOrderId(id),
      alerts: this.orderTasks.buildOperationalAlerts(order),
      priceNotices: listOrderPriceNotices(
        order,
        (productId) => this.products.findById(productId)?.price,
      ),
    };
  }

  applyCatalogPrices(id: string): Order {
    const order = this.findOne(id);
    this.assertPriceDecisionAllowed(order);
    const previousTotal = order.total;
    const changes: Array<{
      index: number;
      productId: string;
      productName: string;
      previousUnitPrice: number;
    }> = [];

    order.items.forEach((item, index) => {
      if (!item.productId) return;
      const product = this.products.findById(item.productId);
      const listPrice = item.listUnitPrice ?? item.unitPrice;
      if (!product || product.price === listPrice) return;
      changes.push({
        index,
        productId: item.productId,
        productName: item.productName,
        previousUnitPrice: item.unitPrice,
      });
      // El precio de catálogo es de lista; el mayorista se reaplica después.
      item.unitPrice = product.price;
      delete item.listUnitPrice;
    });

    if (!changes.length) return order;

    const priced = this.priceOrderItems(
      order.items,
      order.priceType ?? PriceType.LISTA,
      order.customerId,
    );
    order.items = priced.items;
    order.wholesaleApplied = priced.wholesaleApplied;
    order.total = this.calculateTotal(
      order.items,
      normalizeDiscountFields(order),
    );
    for (const line of changes) {
      appendOrderPriceHistory(order, {
        trigger: 'product_update',
        itemIndex: line.index,
        productId: line.productId,
        productName: line.productName,
        previousUnitPrice: line.previousUnitPrice,
        newUnitPrice:
          order.items[line.index]?.unitPrice ?? line.previousUnitPrice,
        previousOrderTotal: previousTotal,
        newOrderTotal: order.total,
      });
    }
    return this.orders.save(order);
  }

  keepCatalogPrices(id: string): Order {
    const order = this.findOne(id);
    this.assertPriceDecisionAllowed(order);
    let changed = false;

    order.items.forEach((item, index) => {
      if (!item.productId) return;
      const product = this.products.findById(item.productId);
      const listPrice = item.listUnitPrice ?? item.unitPrice;
      if (!product || product.price === listPrice) return;
      const kept = rememberKeptLinePrice(
        order,
        index,
        item.unitPrice,
        product.price,
        item.productId,
        item.productName,
      );
      if (kept) changed = true;
    });

    if (!changed) return order;
    return this.orders.save(order);
  }

  /**
   * `keepQuotedPrices`: el pedido viene de un presupuesto aceptado y conserva
   * sus precios tal cual (§16.2); no se reaplica el mayorista.
   */
  create(
    data: CreateOrderDto,
    options: { keepQuotedPrices?: { wholesaleApplied: boolean } } = {},
  ): Order {
    const { customerId, customerName, customer } = this.resolveCustomer(
      data.customerId,
    );
    if (!data.dueDate?.trim()) {
      throw new BadRequestException('La fecha de entrega es obligatoria');
    }
    this.assertDueDateAfterToday(data.dueDate);

    const priceType =
      data.priceType ?? this.defaultPriceTypeForCustomer(customer);
    const normalizedItems = this.normalizeOrderItems(data.items);
    const priced = options.keepQuotedPrices
      ? {
          items: normalizedItems,
          wholesaleApplied: options.keepQuotedPrices.wholesaleApplied,
        }
      : this.priceOrderItems(normalizedItems, priceType, customerId, customer);
    const items = priced.items;
    const services = this.normalizeServices(items);
    const discount = normalizeDiscountFields(data);
    const order: Order = {
      id: this.orders.nextId(),
      createdAt: new Date().toISOString(),
      customerId,
      customerName,
      services,
      items,
      status: OrderStatus.PENDIENTE,
      priceType,
      wholesaleApplied: priced.wholesaleApplied,
      salesChannel: this.normalizeSalesChannel(data.salesChannel),
      total: this.calculateTotal(items, discount),
      discountPercent: discount.discountPercent,
      discountAmount: discount.discountAmount,
      description: this.normalizeDescription(data.description),
      notes: data.notes?.trim() || undefined,
      dueDate: data.dueDate.trim(),
      statusHistory: [],
      priceHistory: [],
      deliveryHistory: [],
    };
    appendOrderStatusHistory(
      order,
      null,
      order.status,
      'auto',
      order.createdAt,
    );
    this.orders.create(order);
    this.orderTasks.syncOrderTasks(order);
    return order;
  }

  update(id: string, data: UpdateOrderDto): Order {
    const current = this.orders.findById(id);
    if (!current) {
      throw new NotFoundException(`Pedido ${id} no encontrado`);
    }

    let customerId = current.customerId;
    let customerName = current.customerName;
    let customer: Customer | undefined;

    if (data.customerId !== undefined) {
      const resolved = this.resolveCustomer(data.customerId);
      customerId = resolved.customerId;
      customerName = resolved.customerName;
      customer = resolved.customer;
    }

    const priceType = data.priceType ?? current.priceType ?? PriceType.LISTA;
    const shouldReprice =
      data.priceType !== undefined ||
      data.customerId !== undefined ||
      data.items !== undefined;

    let items =
      data.items !== undefined
        ? this.normalizeOrderItems(data.items)
        : current.items;
    let wholesaleApplied = current.wholesaleApplied === true;

    if (shouldReprice) {
      const priced = this.priceOrderItems(
        items,
        priceType,
        customerId,
        customer,
      );
      items = priced.items;
      wholesaleApplied = priced.wholesaleApplied;
    }

    const services =
      data.items !== undefined
        ? this.normalizeServices(items)
        : current.services;

    if (data.dueDate !== undefined && !data.dueDate.trim()) {
      throw new BadRequestException('La fecha de entrega es obligatoria');
    }
    if (data.dueDate !== undefined) {
      this.assertDueDateAfterToday(data.dueDate);
    }

    if (data.status !== undefined && data.status !== current.status) {
      throw new BadRequestException(
        'El estado normal del pedido se deriva automáticamente',
      );
    }

    const discount = normalizeDiscountFields({
      discountPercent:
        data.discountPercent !== undefined
          ? data.discountPercent
          : current.discountPercent,
      discountAmount:
        data.discountAmount !== undefined
          ? data.discountAmount
          : current.discountAmount,
    });

    const salesChannel =
      data.salesChannel !== undefined
        ? this.normalizeSalesChannel(data.salesChannel)
        : current.salesChannel;

    const updated: Order = {
      ...current,
      ...data,
      customerId,
      customerName,
      services,
      items,
      priceType,
      wholesaleApplied,
      salesChannel,
      total: this.calculateTotal(items, discount),
      discountPercent: discount.discountPercent,
      discountAmount: discount.discountAmount,
      description:
        data.description !== undefined
          ? this.normalizeDescription(data.description)
          : current.description,
      notes:
        data.notes !== undefined
          ? data.notes.trim() || undefined
          : current.notes,
      dueDate:
        data.dueDate !== undefined ? data.dueDate.trim() : current.dueDate,
      statusHistory: current.statusHistory ?? [],
    };

    if (updated.status !== current.status) {
      appendOrderStatusHistory(
        updated,
        current.status,
        updated.status,
        'manual',
      );
    }

    this.orders.save(updated);
    this.orderTasks.syncOrderTasks(updated);
    return updated;
  }

  updateStatus(id: string, status: OrderStatus): Order {
    const order = this.findOne(id);
    if (
      status !== OrderStatus.CANCELADO &&
      !(
        order.status === OrderStatus.CANCELADO &&
        status === OrderStatus.PENDIENTE
      )
    ) {
      throw new BadRequestException(
        'Solo se permite cancelar o reabrir manualmente un pedido',
      );
    }
    const previousStatus = order.status;
    order.status = status;
    if (!order.statusHistory) {
      order.statusHistory = [];
    }
    appendOrderStatusHistory(order, previousStatus, status, 'manual');
    if (status === OrderStatus.CANCELADO) {
      this.orderTasks.releaseReservations(order);
    } else {
      for (const task of this.printJobs.findByOrderId(order.id)) {
        if (task.status !== PrintJobStatus.CANCELADO) continue;
        task.status =
          task.taskType === TaskType.PREPARE_ORDER
            ? PrintJobStatus.BLOQUEADO
            : PrintJobStatus.POR_HACER;
        task.archived = false;
      }
    }
    this.orderTasks.syncOrderTasks(order);
    return this.orders.save(order);
  }

  remove(id: string): void {
    this.updateStatus(id, OrderStatus.CANCELADO);
  }

  addPayment(
    id: string,
    data: {
      amount: number;
      deposit?: boolean;
      method?: PaymentMethod;
      account?: TreasuryAccount;
      fee?: number;
    },
  ): Order {
    const order = this.findOne(id);
    if (order.status === OrderStatus.CANCELADO) {
      throw new BadRequestException('No se puede cobrar un pedido cancelado');
    }

    const amountCents = toCents(data.amount);
    if (amountCents <= 0) {
      throw new BadRequestException('El monto debe ser mayor a cero');
    }
    if (amountCents > outstandingCents(order)) {
      throw new BadRequestException('El monto supera el saldo pendiente');
    }

    const feeCents = toCents(data.fee ?? 0);
    if (feeCents < 0) {
      throw new BadRequestException('La comisión no puede ser negativa');
    }
    if (feeCents >= amountCents) {
      throw new BadRequestException(
        'La comisión tiene que ser menor que el monto',
      );
    }

    const method = data.method ?? PaymentMethod.EFECTIVO;
    const account = data.account ?? defaultAccountForMethod(method);

    order.payments ??= [];
    order.payments.push({
      id: `${order.id}-pay-${order.payments.length + 1}`,
      amount: amountCents / 100,
      deposit: data.deposit === true,
      createdAt: new Date().toISOString(),
      method,
      account,
      fee: feeCents / 100,
    });
    return this.orders.save(order);
  }

  deliver(id: string, lines: OrderDeliveryLine[]): Order {
    const order = this.findOne(id);
    if (order.status === OrderStatus.CANCELADO) {
      throw new BadRequestException('No se puede entregar un pedido cancelado');
    }
    if (!lines?.length) {
      throw new BadRequestException('La entrega debe incluir al menos un ítem');
    }

    const normalized = lines.map((line) => ({
      orderItemIndex: Number(line.orderItemIndex),
      quantity: Number(line.quantity),
    }));
    const seen = new Set<number>();
    for (const line of normalized) {
      if (
        !Number.isInteger(line.orderItemIndex) ||
        !Number.isInteger(line.quantity) ||
        line.quantity <= 0 ||
        seen.has(line.orderItemIndex)
      ) {
        throw new BadRequestException('Línea de entrega inválida o duplicada');
      }
      seen.add(line.orderItemIndex);
      const item = order.items[line.orderItemIndex];
      if (!item) {
        throw new BadRequestException('El ítem de entrega no existe');
      }
      const pending = item.quantity - (item.deliveredQuantity ?? 0);
      const available = item.productId
        ? (item.reservedQuantity ?? 0) +
          Math.max(
            (item.producedQuantity ?? 0) -
              (item.deliveredFromProductionQuantity ?? 0),
            0,
          )
        : this.serviceDeliverableQuantity(order, item, line.orderItemIndex);
      if (line.quantity > pending || line.quantity > available) {
        throw new BadRequestException(
          available <= 0 && !item.productId
            ? `No se puede entregar "${item.productName}": la tarea todavía no está terminada`
            : `No hay cantidad disponible para entregar "${item.productName}"`,
        );
      }
    }

    for (const line of normalized) {
      const item = order.items[line.orderItemIndex];
      const fromStock = Math.min(line.quantity, item.reservedQuantity ?? 0);
      if (fromStock > 0 && item.productId) {
        const product = this.products.findById(item.productId);
        if (!product || (product.stock ?? 0) < fromStock) {
          throw new BadRequestException(
            `Stock físico inconsistente para "${item.productName}"`,
          );
        }
        product.stock = (product.stock ?? 0) - fromStock;
        this.products.save(product);
        item.reservedQuantity = (item.reservedQuantity ?? 0) - fromStock;
      }
      item.deliveredFromProductionQuantity =
        (item.deliveredFromProductionQuantity ?? 0) +
        (line.quantity - fromStock);
      item.deliveredQuantity = (item.deliveredQuantity ?? 0) + line.quantity;
    }

    order.deliveryHistory ??= [];
    order.deliveryHistory.push({
      id: `delivery-${order.deliveryHistory.length + 1}`,
      deliveredAt: new Date().toISOString(),
      items: normalized,
    });
    this.orderTasks.syncOrderStatusFromTasks(order.id);
    return this.orders.save(order);
  }

  private normalizeServices(items: OrderItem[]): ServiceType[] {
    const services = [...new Set(items.map((item) => item.serviceType))];

    if (!services.length) {
      throw new BadRequestException(
        'El pedido debe incluir al menos un servicio',
      );
    }

    return services;
  }

  normalizeOrderItems(items: OrderItem[]): OrderItem[] {
    return normalizeIncomingOrderItems(items, {
      resolveOrderUnitPrice: (serviceType, productId, clientUnitPrice) =>
        this.costCalculator.resolveOrderUnitPrice(
          serviceType,
          productId,
          clientUnitPrice,
        ),
      findProductById: (productId) => this.products.findById(productId),
    });
  }

  private calculateTotal(
    items: OrderItem[],
    discount: ReturnType<typeof normalizeDiscountFields>,
  ): number {
    const subtotal = calculateOrderItemsSubtotal(items);
    return calculateTotalWithDiscount(subtotal, discount);
  }

  private normalizeDescription(description?: string): string | undefined {
    const sanitized = sanitizeRichTextHtml(description);
    if (!hasRichTextContent(sanitized)) return undefined;

    const plainLength = plainTextFromHtml(sanitized).length;
    if (plainLength > ORDER_RICH_TEXT_MAX_LENGTH) {
      throw new BadRequestException(
        `La descripción no puede superar los ${ORDER_RICH_TEXT_MAX_LENGTH} caracteres`,
      );
    }

    return sanitized;
  }

  private assertDueDateAfterToday(dueDate: string): void {
    if (!isDueDateAfterToday(dueDate)) {
      throw new BadRequestException(DUE_DATE_AFTER_TODAY_MESSAGE);
    }
  }

  private assertPriceDecisionAllowed(order: Order): void {
    if (order.status === OrderStatus.CANCELADO) {
      throw new BadRequestException(
        'No se puede cambiar el precio de un pedido cancelado',
      );
    }
  }

  /** Servicios: solo se entrega si la tarea correspondiente está terminada (§15). */
  private serviceDeliverableQuantity(
    order: Order,
    item: OrderItem,
    itemIndex: number,
  ): number {
    const pending = Math.max(item.quantity - (item.deliveredQuantity ?? 0), 0);
    if (pending <= 0) return 0;

    const tasks = this.printJobs.findByOrderId(order.id);
    if (isDesignPrintConfigured(item)) {
      const productionDone = tasks.some(
        (task) =>
          task.orderItemIndex === itemIndex &&
          task.taskType === TaskType.PRODUCTION &&
          task.status === PrintJobStatus.TERMINADO,
      );
      if (!productionDone) return 0;
      const producedLeft = Math.max(
        (item.producedQuantity ?? 0) -
          (item.deliveredFromProductionQuantity ?? 0),
        0,
      );
      return Math.min(pending, producedLeft || pending);
    }

    const serviceDone = tasks.some(
      (task) =>
        task.orderItemIndex === itemIndex &&
        task.taskType === TaskType.SERVICE &&
        task.status === PrintJobStatus.TERMINADO,
    );
    return serviceDone ? pending : 0;
  }

  private resolveCustomer(customerId?: string | null): {
    customerId: string | null;
    customerName: string;
    customer: Customer;
  } {
    const trimmed = customerId?.trim();
    if (!trimmed) {
      throw new BadRequestException('El pedido requiere un cliente asociado');
    }

    const customer = this.customers.findById(trimmed);
    if (!customer) {
      throw new BadRequestException('Cliente no válido');
    }

    return {
      customerId: customer.id,
      customerName: customer.name,
      customer,
    };
  }

  private defaultPriceTypeForCustomer(customer?: Customer | null): PriceType {
    return customer?.type === CustomerType.REVENDEDOR
      ? PriceType.MAYORISTA
      : PriceType.LISTA;
  }

  private normalizeSalesChannel(
    value?: SalesChannel | null,
  ): SalesChannel | undefined {
    if (value == null) return undefined;
    return value;
  }

  private priceOrderItems(
    items: OrderItem[],
    priceType: PriceType,
    customerId?: string | null,
    customer?: Customer | null,
  ): { items: OrderItem[]; wholesaleApplied: boolean } {
    const resolvedCustomer =
      customer ??
      (customerId ? this.customers.findById(customerId) : undefined) ??
      null;
    const settings = normalizeWholesaleDiscount(
      this.store.generalSettings.wholesaleDiscount,
    );
    return applyWholesalePricing(items, {
      priceType,
      customer: resolvedCustomer,
      settings,
    });
  }
}
