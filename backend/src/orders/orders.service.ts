import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FilamentType,
  OrderStatus,
  PrintJobStatus,
  ServiceType,
  TaskType,
} from '../common/enums';
import {
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
import {
  appendOrderStatusHistory,
} from './order-status-history.util';
import { normalizeServiceType, isDesignService } from '../common/service-type.util';
import { isDesignPrintConfigured } from './design-print.util';
import {
  isCustomFdmOrderLine,
  isFdmQuoteConfigured,
} from './order-fdm-quote.util';
import {
  isCustomEstampadoOrderLine,
  isEstampadoQuoteConfigured,
} from './order-estampado-quote.util';
import {
  normalizeEstampadoPressCycles,
  normalizeEstampadoPrints,
  normalizeEstampadoSupplies,
} from '../products/estampado-product.util';
import {
  normalizeFdmFilaments,
  totalFdmFilamentGrams,
} from '../products/fdm-product.util';
import { OrderTasksService } from '../print-jobs/order-tasks.service';
import { PrintJobsService } from '../print-jobs/print-jobs.service';
import { CostCalculatorService } from '../settings/cost-calculator.service';
import {
  CustomerRepository,
  OrderRepository,
  ProductRepository,
} from '../store/repositories';
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
      newUnitPrice: number;
    }> = [];

    order.items.forEach((item, index) => {
      if (!item.productId) return;
      const product = this.products.findById(item.productId);
      if (!product || product.price === item.unitPrice) return;
      changes.push({
        index,
        productId: item.productId,
        productName: item.productName,
        previousUnitPrice: item.unitPrice,
        newUnitPrice: product.price,
      });
      item.unitPrice = product.price;
    });

    if (!changes.length) return order;

    order.total = this.calculateTotal(order.items, normalizeDiscountFields(order));
    for (const line of changes) {
      appendOrderPriceHistory(order, {
        trigger: 'product_update',
        itemIndex: line.index,
        productId: line.productId,
        productName: line.productName,
        previousUnitPrice: line.previousUnitPrice,
        newUnitPrice: line.newUnitPrice,
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
      if (!product || product.price === item.unitPrice) return;
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

  create(data: CreateOrderDto): Order {
    const { customerId, customerName } = this.resolveCustomer(data.customerId);
    if (!data.dueDate?.trim()) {
      throw new BadRequestException('La fecha de entrega es obligatoria');
    }
    this.assertDueDateAfterToday(data.dueDate);

    const items = this.normalizeOrderItems(data.items);
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

    if (data.customerId !== undefined) {
      const resolved = this.resolveCustomer(data.customerId);
      customerId = resolved.customerId;
      customerName = resolved.customerName;
    }

    const items =
      data.items !== undefined
        ? this.normalizeOrderItems(data.items)
        : current.items;
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

    const updated: Order = {
      ...current,
      ...data,
      customerId,
      customerName,
      services,
      items,
      total: this.calculateTotal(items, discount),
      discountPercent: discount.discountPercent,
      discountAmount: discount.discountAmount,
      description:
        data.description !== undefined
          ? this.normalizeDescription(data.description)
          : current.description,
      notes:
        data.notes !== undefined ? data.notes.trim() || undefined : current.notes,
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
      !(order.status === OrderStatus.CANCELADO && status === OrderStatus.PENDIENTE)
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
    data: { amount: number; deposit?: boolean },
  ): Order {
    const order = this.findOne(id);
    if (order.status === OrderStatus.CANCELADO) {
      throw new BadRequestException('No se puede cobrar un pedido cancelado');
    }

    const amountCents = this.toCents(data.amount);
    if (amountCents <= 0) {
      throw new BadRequestException('El monto debe ser mayor a cero');
    }

    const paidCents = (order.payments ?? []).reduce(
      (sum, payment) => sum + this.toCents(payment.amount),
      0,
    );
    const balanceCents = this.toCents(order.total) - paidCents;
    if (amountCents > balanceCents) {
      throw new BadRequestException('El monto supera el saldo pendiente');
    }

    order.payments ??= [];
    order.payments.push({
      id: `${order.id}-pay-${order.payments.length + 1}`,
      amount: amountCents / 100,
      deposit: data.deposit === true,
      createdAt: new Date().toISOString(),
    });
    return order;
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
      const item = order.items[line.orderItemIndex]!;
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
      item.deliveredQuantity =
        (item.deliveredQuantity ?? 0) + line.quantity;
    }

    order.deliveryHistory ??= [];
    order.deliveryHistory.push({
      id: `delivery-${order.deliveryHistory.length + 1}`,
      deliveredAt: new Date().toISOString(),
      items: normalized,
    });
    this.orderTasks.syncOrderStatusFromTasks(order.id);
    return order;
  }

  purgeExpiredTerminalOrders(): number {
    // Los pedidos y sus tareas forman parte del historial operativo.
    // La retención ya no puede purgarlos físicamente.
    return 0;
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
    if (!items?.length) {
      throw new BadRequestException(
        'El pedido debe incluir al menos una línea de trabajo',
      );
    }

    return items.map((item, index) => {
      const serviceType = normalizeServiceType(item.serviceType);
      const productName = item.productName?.trim();
      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unitPrice);
      const productId = item.productId?.trim() || undefined;

      if (!serviceType) {
        throw new BadRequestException(
          `Línea ${index + 1}: servicio inválido`,
        );
      }

      if (!productName) {
        throw new BadRequestException(
          `Línea ${index + 1}: descripción inválida`,
        );
      }

      if (isDesignService(serviceType) && productId) {
        throw new BadRequestException(
          `Línea ${index + 1}: el diseño no debe vincularse a un producto del catálogo`,
        );
      }

      if (
        serviceType === ServiceType.DISENO_GRAFICO &&
        item.includesPrint &&
        !isDesignPrintConfigured(item)
      ) {
        throw new BadRequestException(
          `Línea ${index + 1}: completá tipo de impresión y tamaño (ancho × alto)`,
        );
      }

      if (
        !isDesignService(serviceType) &&
        !productId &&
        !isCustomFdmOrderLine({ serviceType, productId }) &&
        !isCustomEstampadoOrderLine({ serviceType, productId })
      ) {
        throw new BadRequestException(
          `Línea ${index + 1}: producto inválido`,
        );
      }

      if (isCustomFdmOrderLine({ serviceType, productId })) {
        if (!isFdmQuoteConfigured(item)) {
          throw new BadRequestException(
            `Línea ${index + 1}: completá tipo de filamento y gramos u horas de impresión`,
          );
        }
      }

      if (isCustomEstampadoOrderLine({ serviceType, productId })) {
        if (!isEstampadoQuoteConfigured(item)) {
          throw new BadRequestException(
            `Línea ${index + 1}: completá insumos, impresos/medidas o bajadas de plancha`,
          );
        }
      }

      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new BadRequestException(
          `Línea ${index + 1}: cantidad inválida`,
        );
      }

      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        throw new BadRequestException(
          `Línea ${index + 1}: precio unitario inválido`,
        );
      }

      const resolvedUnitPrice = this.costCalculator.resolveOrderUnitPrice(
        serviceType,
        productId,
        unitPrice,
      );

      let resolvedProductName = productName;
      if (!isDesignService(serviceType) && productId) {
        const product = this.products.findById(productId);
        if (!product) {
          throw new BadRequestException(
            `Línea ${index + 1}: producto ${productId} no encontrado`,
          );
        }
        resolvedProductName = product.name;
      }

      const fdmFields =
        serviceType === ServiceType.IMPRESION_3D
          ? (() => {
              const filaments = normalizeFdmFilaments(item.filaments, {
                grams: item.grams != null ? Number(item.grams) : undefined,
                filamentType: item.filamentType as FilamentType | undefined,
              }).filter((line) => line.grams > 0);
              const grams =
                filaments.length > 0
                  ? totalFdmFilamentGrams(filaments)
                  : item.grams != null
                    ? Number(item.grams)
                    : undefined;
              const filamentType =
                filaments.find((line) => line.filamentType)?.filamentType ??
                (item.filamentType as FilamentType | undefined);
              const laborNote = item.laborNote?.trim() || undefined;
              const workTimeHours =
                item.workTimeHours != null
                  ? Math.max(0, Number(item.workTimeHours) || 0)
                  : undefined;
              return {
                printTimeHours:
                  item.printTimeHours != null
                    ? Number(item.printTimeHours)
                    : undefined,
                grams,
                filamentType,
                filaments: filaments.length ? filaments : undefined,
                workTimeHours,
                laborNote,
              };
            })()
          : {};

      const estampadoFields =
        serviceType === ServiceType.ESTAMPADO
          ? {
              estampadoPrints: normalizeEstampadoPrints(item.estampadoPrints),
              estampadoPressCycles: normalizeEstampadoPressCycles(
                item.estampadoPressCycles,
              ),
              estampadoSupplies: normalizeEstampadoSupplies(
                item.estampadoSupplies,
              ),
            }
          : {};

      const designFields = isDesignService(serviceType)
        ? {
            designUnitPrice: Number(item.designUnitPrice ?? item.unitPrice),
            budgetedHours: this.normalizeBudgetedHours(item.budgetedHours),
            chargeMode:
              item.chargeMode === 'hours' || item.chargeMode === 'fixed'
                ? item.chargeMode
                : undefined,
            workKind: item.workKind?.trim() || undefined,
            deliverables: Array.isArray(item.deliverables)
              ? item.deliverables
                  .map((entry) => String(entry).trim())
                  .filter(Boolean)
              : undefined,
            includesRevisions: item.includesRevisions || undefined,
            needsClientProduct: item.needsClientProduct || undefined,
            linkPrint: item.linkPrint || undefined,
          }
        : {};

      const unitCost =
        item.unitCost != null && Number.isFinite(Number(item.unitCost))
          ? Math.max(0, Number(item.unitCost))
          : undefined;

      return {
        serviceType,
        productId,
        productName: resolvedProductName,
        quantity,
        unitPrice: resolvedUnitPrice,
        unitPriceManual: item.unitPriceManual === true ? true : undefined,
        unitCost,
        ...fdmFields,
        ...estampadoFields,
        ...designFields,
        includesPrint:
          serviceType === ServiceType.DISENO_GRAFICO
            ? (item.includesPrint ?? undefined)
            : undefined,
        printPaperType:
          serviceType === ServiceType.DISENO_GRAFICO
            ? item.printPaperType
            : undefined,
        printWidthCm:
          serviceType === ServiceType.DISENO_GRAFICO
            ? item.printWidthCm
            : undefined,
        printLengthCm:
          serviceType === ServiceType.DISENO_GRAFICO
            ? item.printLengthCm
            : undefined,
        printImpresoId:
          serviceType === ServiceType.DISENO_GRAFICO
            ? item.printImpresoId?.trim() || undefined
            : undefined,
        deliveredQuantity: item.deliveredQuantity ?? 0,
        reservedQuantity: item.reservedQuantity ?? 0,
        productionRequiredQuantity: item.productionRequiredQuantity ?? 0,
        producedQuantity: item.producedQuantity ?? 0,
        deliveredFromProductionQuantity:
          item.deliveredFromProductionQuantity ?? 0,
      };
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

  private toCents(value: number): number {
    return Math.round(Number(value) * 100);
  }

  private normalizeBudgetedHours(value: unknown): number | undefined {
    const hours = Number(value);
    if (!Number.isFinite(hours) || hours < 0) return undefined;
    return hours;
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
    const pending = Math.max(
      item.quantity - (item.deliveredQuantity ?? 0),
      0,
    );
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
  } {
    const trimmed = customerId?.trim();
    if (!trimmed) {
      throw new BadRequestException('El pedido requiere un cliente asociado');
    }

    const customer = this.customers.findById(trimmed);
    if (!customer) {
      throw new BadRequestException('Cliente no válido');
    }

    return { customerId: customer.id, customerName: customer.name };
  }
}
