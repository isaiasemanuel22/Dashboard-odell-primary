import { Injectable, OnModuleInit } from '@nestjs/common';
import { OrderStatus, PrintJobStatus, ProductType, ServiceType } from '../common/enums';
import { Order, OrderItem, PrintJob, Product3D } from '../common/interfaces';
import { appendOrderStatusHistory } from '../orders/order-status-history.util';
import { StoreService } from '../store/store.service';

@Injectable()
export class OrderTasksService implements OnModuleInit {
  constructor(private readonly store: StoreService) {}

  onModuleInit(): void {
    this.syncAll();
  }

  syncAll(): void {
    const orderIds = new Set(this.store.orders.map((order) => order.id));

    for (const order of this.store.orders) {
      this.syncOrderTasks(order);
    }

    this.store.printJobs = this.store.printJobs.filter((job) =>
      orderIds.has(job.orderId),
    );

    for (const order of this.store.orders) {
      if (!this.isTerminalOrder(order.status)) {
        this.syncOrderStatusFromTasks(order.id);
      }
    }
  }

  syncOrderTasks(order: Order): void {
    if (order.status === OrderStatus.ENTREGADO) {
      this.removeTasksForOrder(order.id);
      return;
    }

    if (order.status === OrderStatus.CANCELADO) {
      this.finalizeCancelledTasks(order);
      return;
    }

    order.items.forEach((item, index) => {
      const existing = this.findTask(order.id, index, item);
      if (existing) {
        this.updateTaskMetadata(existing, order, item, index);
        return;
      }
      this.store.printJobs.push(this.createTask(order, item, index));
    });

    this.removeStaleTasks(order);
    this.applyOrderStatusToTasks(order);
  }

  /** Deriva el estado del pedido a partir de sus tareas y lo persiste. */
  syncOrderStatusFromTasks(orderId: string): void {
    const order = this.store.orders.find((item) => item.id === orderId);
    if (!order || this.isTerminalOrder(order.status)) return;

    const tasks = this.getTasksForOrder(orderId);
    if (!tasks.length) return;

    const nextStatus = this.deriveOrderStatus(tasks);
    if (order.status !== nextStatus) {
      const previousStatus = order.status;
      order.status = nextStatus;
      if (!order.statusHistory) {
        order.statusHistory = [];
      }
      appendOrderStatusHistory(order, previousStatus, nextStatus, 'auto');
      if (nextStatus === OrderStatus.COMPLETADO) {
        this.applyOrderStatusToTasks(order);
      }
    }
  }

  removeTasksForOrder(orderId: string): void {
    this.store.printJobs = this.store.printJobs.filter(
      (job) => job.orderId !== orderId,
    );
  }

  private getTasksForOrder(orderId: string): PrintJob[] {
    return this.store.printJobs.filter((job) => job.orderId === orderId);
  }

  private isTerminalOrder(status: OrderStatus): boolean {
    return (
      status === OrderStatus.ENTREGADO || status === OrderStatus.CANCELADO
    );
  }

  /** Pedidos entregados no tienen tareas en la cola de trabajo. */
  isVisibleInQueue(orderId: string): boolean {
    const order = this.store.orders.find((item) => item.id === orderId);
    return !!order && order.status !== OrderStatus.ENTREGADO;
  }

  private deriveOrderStatus(tasks: PrintJob[]): OrderStatus {
    const openTasks = tasks.filter(
      (task) => task.status !== PrintJobStatus.CANCELADO,
    );

    if (!openTasks.length) {
      return OrderStatus.CANCELADO;
    }

    if (openTasks.every((task) => task.status === PrintJobStatus.TERMINADO)) {
      return OrderStatus.COMPLETADO;
    }

    if (openTasks.some((task) => this.isTaskInProduction(task))) {
      return OrderStatus.EN_PRODUCCION;
    }

    return OrderStatus.PENDIENTE;
  }

  private isTaskInProduction(task: PrintJob): boolean {
    return (
      task.status === PrintJobStatus.EN_PROCESO ||
      task.status === PrintJobStatus.BLOQUEADO ||
      task.status === PrintJobStatus.EN_REVISION
    );
  }

  private applyOrderStatusToTasks(order: Order): void {
    const tasks = this.getTasksForOrder(order.id);

    switch (order.status) {
      case OrderStatus.CANCELADO:
        for (const job of tasks) {
          job.status = PrintJobStatus.CANCELADO;
          job.active = false;
        }
        break;

      case OrderStatus.COMPLETADO:
        for (const job of tasks) {
          if (job.status === PrintJobStatus.CANCELADO) continue;
          job.status = PrintJobStatus.TERMINADO;
          job.active = false;
          job.completedAt = job.completedAt ?? new Date().toISOString();
        }
        break;

      case OrderStatus.EN_PRODUCCION:
        for (const job of tasks) {
          if (
            job.status === PrintJobStatus.CANCELADO ||
            job.status === PrintJobStatus.TERMINADO
          ) {
            continue;
          }
          job.active = true;
        }
        break;

      case OrderStatus.PENDIENTE:
        for (const job of tasks) {
          if (
            job.status === PrintJobStatus.CANCELADO ||
            job.status === PrintJobStatus.TERMINADO
          ) {
            continue;
          }
          job.active = false;
          if (this.isTaskInProduction(job)) {
            job.status = PrintJobStatus.POR_HACER;
            job.startedAt = undefined;
          }
        }
        break;
    }
  }

  private finalizeCancelledTasks(order: Order): void {
    for (const job of this.getTasksForOrder(order.id)) {
      if (job.status !== PrintJobStatus.CANCELADO) {
        job.status = PrintJobStatus.CANCELADO;
        job.active = false;
      }
    }

    this.removeStaleTasks(order);
  }

  private findTask(
    orderId: string,
    itemIndex: number,
    item: OrderItem,
  ): PrintJob | undefined {
    const byIndex = this.store.printJobs.find(
      (job) => job.orderId === orderId && job.orderItemIndex === itemIndex,
    );
    if (byIndex) return byIndex;

    return this.store.printJobs.find(
      (job) =>
        job.orderId === orderId &&
        job.orderItemIndex === undefined &&
        job.type === item.serviceType &&
        job.productName === item.productName &&
        (item.productId ? job.productId === item.productId : !job.productId),
    );
  }

  private createTask(order: Order, item: OrderItem, itemIndex: number): PrintJob {
    return {
      id: this.store.nextId('job', this.store.printJobs),
      orderId: order.id,
      orderItemIndex: itemIndex,
      customerName: order.customerName,
      productName: item.productName,
      productId: item.productId,
      type: item.serviceType,
      status: PrintJobStatus.POR_HACER,
      active: order.status === OrderStatus.EN_PRODUCCION,
      priority: this.calcPriority(order.dueDate),
      machine: this.defaultMachine(item),
      estimatedHours: this.estimateHours(item),
      dueDate: order.dueDate,
    };
  }

  private updateTaskMetadata(
    job: PrintJob,
    order: Order,
    item: OrderItem,
    itemIndex: number,
  ): void {
    job.orderItemIndex = itemIndex;
    job.customerName = order.customerName;
    job.productName = item.productName;
    job.productId = item.productId;
    job.type = item.serviceType;
    job.dueDate = order.dueDate;
    job.priority = this.calcPriority(order.dueDate);
    job.machine = this.defaultMachine(item);
    job.estimatedHours = this.estimateHours(item);
  }

  private removeStaleTasks(order: Order): void {
    const validIndices = new Set(order.items.map((_, index) => index));

    this.store.printJobs = this.store.printJobs.filter((job) => {
      if (job.orderId !== order.id) return true;
      if (job.orderItemIndex === undefined) return false;
      return validIndices.has(job.orderItemIndex);
    });
  }

  private calcPriority(dueDate: string): number {
    const days =
      (new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    if (days <= 3) return 3;
    if (days <= 7) return 2;
    return 1;
  }

  private defaultMachine(item: OrderItem): string {
    if (item.serviceType === ServiceType.DISENO) {
      const name = item.productName.toLowerCase();
      if (name.includes('modelado') || name.includes('3d')) {
        return 'Modelado 3D';
      }
      return 'Diseño gráfico';
    }

    if (item.serviceType === ServiceType.IMPRESION_3D) {
      if (item.productId) {
        const product = this.store.products.find((p) => p.id === item.productId);
        if (product?.type === ProductType.RESINA) return 'Impresora resina';
      }
      return 'Impresora FDM';
    }

    return 'Estampado';
  }

  private estimateHours(item: OrderItem): number {
    if (item.productId) {
      const product = this.store.products.find((p) => p.id === item.productId);
      if (product) {
        const product3d = product as Product3D;
        if (product3d.printTimeHours) {
          return Math.max(
            1,
            Math.ceil(product3d.printTimeHours * item.quantity),
          );
        }
        if (product.assemblyTimeHours) {
          return Math.max(
            1,
            Math.ceil(product.assemblyTimeHours * item.quantity),
          );
        }
      }
    }

    switch (item.serviceType) {
      case ServiceType.DISENO:
        return 4;
      case ServiceType.IMPRESION_3D:
        return 6;
      case ServiceType.ESTAMPADO:
        return Math.max(1, item.quantity);
      default:
        return 2;
    }
  }
}
