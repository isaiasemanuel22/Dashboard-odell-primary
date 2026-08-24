import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
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
  calculateItemsSubtotal,
  calculateTotalWithDiscount,
  normalizeDiscountFields,
} from '../common/utils/discount.util';
import { filterOrders, OrderListFilters } from './order-filter.util';
import {
  appendOrderStatusHistory,
} from './order-status-history.util';
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
    };
  }

  create(data: CreateOrderDto): Order {
    const { customerId, customerName } = this.resolveCustomer(data.customerId);
    if (!data.dueDate?.trim()) {
      throw new BadRequestException('La fecha de entrega es obligatoria');
    }

    const items = this.normalizeItems(data.items);
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
      data.items !== undefined ? this.normalizeItems(data.items) : current.items;
    const services =
      data.items !== undefined
        ? this.normalizeServices(items)
        : current.services;

    if (data.dueDate !== undefined && !data.dueDate.trim()) {
      throw new BadRequestException('La fecha de entrega es obligatoria');
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
    return order;
  }

  remove(id: string): void {
    this.updateStatus(id, OrderStatus.CANCELADO);
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
        : pending;
      if (line.quantity > pending || line.quantity > available) {
        throw new BadRequestException(
          `No hay cantidad disponible para entregar "${item.productName}"`,
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

  private normalizeItems(items: OrderItem[]): OrderItem[] {
    if (!items?.length) {
      throw new BadRequestException(
        'El pedido debe incluir al menos una línea de trabajo',
      );
    }

    return items.map((item, index) => {
      const serviceType = item.serviceType;
      const productName = item.productName?.trim();
      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unitPrice);
      const productId = item.productId?.trim() || undefined;

      if (!serviceType || !Object.values(ServiceType).includes(serviceType)) {
        throw new BadRequestException(
          `Línea ${index + 1}: servicio inválido`,
        );
      }

      if (!productName) {
        throw new BadRequestException(
          `Línea ${index + 1}: descripción inválida`,
        );
      }

      if (serviceType === ServiceType.DISENO && productId) {
        throw new BadRequestException(
          `Línea ${index + 1}: el diseño no debe vincularse a un producto del catálogo`,
        );
      }

      if (serviceType !== ServiceType.DISENO && !productId) {
        throw new BadRequestException(
          `Línea ${index + 1}: producto inválido`,
        );
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
      if (serviceType !== ServiceType.DISENO && productId) {
        const product = this.products.findById(productId);
        if (!product) {
          throw new BadRequestException(
            `Línea ${index + 1}: producto ${productId} no encontrado`,
          );
        }
        resolvedProductName = product.name;
      }

      return {
        serviceType,
        productId,
        productName: resolvedProductName,
        quantity,
        unitPrice: resolvedUnitPrice,
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
    const subtotal = calculateItemsSubtotal(items);
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

  private resolveCustomer(customerId?: string | null): {
    customerId: string | null;
    customerName: string;
  } {
    const trimmed = customerId?.trim();
    if (!trimmed) {
      return { customerId: null, customerName: 'Sin cliente' };
    }

    const customer = this.customers.findById(trimmed);
    if (!customer) {
      throw new BadRequestException('Cliente no válido');
    }

    return { customerId: customer.id, customerName: customer.name };
  }
}
