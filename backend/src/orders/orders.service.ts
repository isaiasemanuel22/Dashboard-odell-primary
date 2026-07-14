import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, ServiceType } from '../common/enums';
import { Order, OrderItem, OrderOverview } from '../common/interfaces';
import { CreateOrderDto, UpdateOrderDto } from '../common/dto';
import { filterOrders, OrderListFilters } from './order-filter.util';
import {
  assertOrderStatusTransition,
} from '../common/validators/domain.validators';
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
import { shouldPurgeTerminalOrder } from './order-retention.util';

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
    };
  }

  create(data: CreateOrderDto): Order {
    const customer = this.customers.findById(data.customerId);
    if (!customer) {
      throw new BadRequestException('Cliente no válido');
    }
    if (!data.dueDate?.trim()) {
      throw new BadRequestException('La fecha de entrega es obligatoria');
    }

    const items = this.normalizeItems(data.items);
    const services = this.normalizeServices(data.services, items);
    const order: Order = {
      id: this.orders.nextId(),
      createdAt: new Date().toISOString(),
      customerId: customer.id,
      customerName: customer.name,
      services,
      items,
      status: data.status ?? OrderStatus.PENDIENTE,
      total: this.calculateTotal(items),
      description: this.normalizeDescription(data.description),
      notes: data.notes?.trim() || undefined,
      dueDate: data.dueDate.trim(),
      statusHistory: [],
    };
    appendOrderStatusHistory(
      order,
      null,
      order.status,
      'manual',
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
      const customer = this.customers.findById(data.customerId);
      if (!customer) {
        throw new BadRequestException('Cliente no válido');
      }
      customerId = customer.id;
      customerName = customer.name;
    }

    const items =
      data.items !== undefined ? this.normalizeItems(data.items) : current.items;
    const services =
      data.services !== undefined || data.items !== undefined
        ? this.normalizeServices(data.services ?? current.services, items)
        : current.services;

    if (data.dueDate !== undefined && !data.dueDate.trim()) {
      throw new BadRequestException('La fecha de entrega es obligatoria');
    }

    if (data.status !== undefined && data.status !== current.status) {
      assertOrderStatusTransition(current.status, data.status);
    }

    const updated: Order = {
      ...current,
      ...data,
      customerId,
      customerName,
      services,
      items,
      total: this.calculateTotal(items),
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
    assertOrderStatusTransition(order.status, status);
    const previousStatus = order.status;
    order.status = status;
    if (!order.statusHistory) {
      order.statusHistory = [];
    }
    appendOrderStatusHistory(order, previousStatus, status, 'manual');
    this.orderTasks.syncOrderTasks(order);
    return order;
  }

  remove(id: string): void {
    if (!this.orders.findById(id)) {
      throw new NotFoundException(`Pedido ${id} no encontrado`);
    }
    this.orderTasks.removeTasksForOrder(id);
    this.orders.remove(id);
  }

  purgeExpiredTerminalOrders(): number {
    const expiredIds = this.orders
      .findAll()
      .filter((order) => shouldPurgeTerminalOrder(order))
      .map((order) => order.id);

    for (const id of expiredIds) {
      this.remove(id);
    }

    return expiredIds.length;
  }

  private normalizeServices(
    services: ServiceType[] | undefined,
    items: OrderItem[],
  ): ServiceType[] {
    const fromItems = [...new Set(items.map((item) => item.serviceType))];
    const merged = [...new Set([...(services ?? []), ...fromItems])];

    if (!merged.length) {
      throw new BadRequestException(
        'El pedido debe incluir al menos un servicio',
      );
    }

    for (const item of items) {
      if (!merged.includes(item.serviceType)) {
        throw new BadRequestException(
          `El ítem "${item.productName}" no corresponde a un servicio incluido en el pedido`,
        );
      }
    }

    return merged;
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
      };
    });
  }

  private calculateTotal(items: OrderItem[]): number {
    return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  }

  private normalizeDescription(description?: string): string | undefined {
    const trimmed = description?.trim();
    if (!trimmed) return undefined;
    if (trimmed.length > 1000) {
      throw new BadRequestException(
        'La descripción no puede superar los 1000 caracteres',
      );
    }
    return trimmed;
  }
}
