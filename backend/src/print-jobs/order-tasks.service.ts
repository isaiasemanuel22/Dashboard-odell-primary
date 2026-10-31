import { BadRequestException, ForbiddenException, Injectable, OnModuleInit } from '@nestjs/common';
import {
  OrderStatus,
  PrintJobStatus,
  ProductType,
  ServiceType,
  SupplyCategory,
  TaskType,
} from '../common/enums';
import { Order, OrderItem, OrderAlert, PrintJob, Supply } from '../common/interfaces';
import { isIndistintoColor } from '../common/color.util';
import { appendOrderStatusHistory } from '../orders/order-status-history.util';
import { StoreService } from '../store/store.service';
import { isDesignService } from '../common/service-type.util';
import {
  isDesignPrintConfigured,
} from '../orders/design-print.util';
import {
  isCustomFdmOrderLine,
  isFdmQuoteConfigured,
} from '../orders/order-fdm-quote.util';
import { buildProductStockOverview } from '../products/product-stock.util';
import {
  calcTaskPriority,
  defaultTaskMachine,
  estimateTaskHours,
  productionTaskName as buildProductionTaskName,
} from './order-task-estimate';

@Injectable()
export class OrderTasksService implements OnModuleInit {
  constructor(private readonly store: StoreService) {}

  onModuleInit(): void {
    this.syncAll();
  }

  syncAll(): void {
    for (const order of this.store.orders) {
      this.syncOrderTasks(order);
    }

    for (const order of this.store.orders) {
      if (!this.isTerminalOrder(order.status)) {
        this.syncOrderStatusFromTasks(order.id);
      }
    }
  }

  syncOrderTasks(order: Order): void {
    if (order.status === OrderStatus.ENTREGADO) {
      this.archiveTasksForOrder(order.id);
      return;
    }

    if (order.status === OrderStatus.CANCELADO) {
      this.finalizeCancelledTasks(order);
      return;
    }

    order.items.forEach((item) => this.ensureFulfillment(item));

    order.items.forEach((item, index) => {
      if (item.productId) {
        this.planCatalogItemFulfillment(order, item, index);
        return;
      }
      this.ensureItemTask(order, item, index, TaskType.SERVICE);
      if (isDesignPrintConfigured(item)) {
        this.planDesignPrintFulfillment(order, item, index);
      } else if (
        isCustomFdmOrderLine(item) &&
        isFdmQuoteConfigured(item)
      ) {
        this.planCustomFdmFulfillment(order, item, index);
      } else {
        this.cancelOpenProductionTask(order.id, index);
      }
    });

    if (order.items.some((item) => !!item.productId)) {
      this.ensurePrepareTask(order);
    }

    this.cancelStaleTasks(order);
    this.syncOrderStatusFromTasks(order.id);
  }

  /** Deriva el estado del pedido a partir de sus tareas y lo persiste. */
  syncOrderStatusFromTasks(orderId: string): void {
    const order = this.store.orders.find((item) => item.id === orderId);
    if (!order || this.isTerminalOrder(order.status)) return;

    const tasks = this.getTasksForOrder(orderId);
    const delivered = order.items.reduce(
      (sum, item) => sum + (item.deliveredQuantity ?? 0),
      0,
    );
    const requested = order.items.reduce((sum, item) => sum + item.quantity, 0);
    const nextStatus =
      requested > 0 && delivered >= requested
        ? OrderStatus.ENTREGADO
        : delivered > 0
          ? OrderStatus.PARCIALMENTE_ENTREGADO
          : tasks.length
            ? this.deriveOrderStatus(tasks)
            : OrderStatus.PENDIENTE;
    if (order.status !== nextStatus) {
      const previousStatus = order.status;
      order.status = nextStatus;
      if (!order.statusHistory) {
        order.statusHistory = [];
      }
      appendOrderStatusHistory(order, previousStatus, nextStatus, 'auto');
      if (nextStatus === OrderStatus.ENTREGADO) {
        this.archiveTasksForOrder(order.id);
      }
    }
  }

  /** Conservado por compatibilidad: el dominio operativo nunca borra historial. */
  removeTasksForOrder(orderId: string): void {
    this.archiveTasksForOrder(orderId);
  }

  beforeStatusChange(
    job: PrintJob,
    next: PrintJobStatus,
    actorUserId?: string,
  ): void {
    if (
      job.status === PrintJobStatus.BLOQUEADO &&
      next !== PrintJobStatus.BLOQUEADO &&
      job.taskType === TaskType.PRODUCTION
    ) {
      if (!actorUserId || !job.responsibleUserId) {
        throw new ForbiddenException(
          'La tarea bloqueada requiere responsable e identidad autenticada',
        );
      }
      if (actorUserId !== job.responsibleUserId) {
        throw new ForbiddenException(
          'Solo el responsable actual puede desbloquear la tarea',
        );
      }
      if (
        job.taskType === TaskType.PRODUCTION &&
        !this.hasProductionSupplies(job)
      ) {
        throw new BadRequestException(
          'Los insumos requeridos todavía no están disponibles',
        );
      }
      job.blockedReason = undefined;
      job.suppliesAvailableNotifiedAt = undefined;
    }

    if (
      job.taskType === TaskType.PREPARE_ORDER &&
      next === PrintJobStatus.EN_PROCESO
    ) {
      this.reserveStockAndCreateProduction(job.orderId);
    }

    if (
      job.taskType === TaskType.PREPARE_ORDER &&
      next === PrintJobStatus.TERMINADO &&
      this.prepareStillHasOpenWork(job.orderId, job.id)
    ) {
      throw new BadRequestException(
        'Preparar pedido sigue activo hasta que el resto de las tareas esté terminado',
      );
    }

    if (
      job.status === PrintJobStatus.BLOQUEADO &&
      next !== PrintJobStatus.BLOQUEADO &&
      job.taskType !== TaskType.PRODUCTION
    ) {
      job.blockedReason = undefined;
    }
  }

  afterStatusChange(job: PrintJob): void {
    if (
      job.taskType === TaskType.PRODUCTION &&
      job.status === PrintJobStatus.TERMINADO &&
      job.orderItemIndex >= 0
    ) {
      const order = this.store.getOrderById(job.orderId);
      const item = order?.items[job.orderItemIndex];
      if (item) {
        item.producedQuantity = Math.max(
          item.producedQuantity ?? 0,
          job.quantity ?? item.productionRequiredQuantity ?? 0,
        );
      }
    }
    this.syncOrderStatusFromTasks(job.orderId);
  }

  notifySupplyAvailability(): void {
    const now = new Date().toISOString();
    for (const job of this.store.printJobs) {
      if (
        job.taskType === TaskType.PRODUCTION &&
        job.status === PrintJobStatus.BLOQUEADO &&
        !job.suppliesAvailableNotifiedAt &&
        this.hasProductionSupplies(job)
      ) {
        job.suppliesAvailableNotifiedAt = now;
      }
    }
  }

  releaseReservations(order: Order): void {
    for (const item of order.items) {
      item.reservedQuantity = 0;
      item.productionRequiredQuantity = 0;
    }
  }

  buildOperationalAlerts(order: Order): OrderAlert[] {
    const alerts: OrderAlert[] = [];
    const tasks = this.getTasksForOrder(order.id);

    order.items.forEach((item, index) => {
      if (!item.productId) return;

      const pending = Math.max(
        item.quantity - (item.deliveredQuantity ?? 0),
        0,
      );
      if (pending <= 0) return;

      const toProduce = Math.max(
        (item.productionRequiredQuantity ?? 0) - (item.producedQuantity ?? 0),
        0,
      );
      const fromStock = Math.max(
        pending - toProduce - (item.producedQuantity ?? 0),
        0,
      );

      if (toProduce > 0) {
        alerts.push({
          code: 'insufficient_stock',
          message:
            fromStock === 0
              ? `${item.productName}: sin stock disponible; requiere producción (${toProduce} un.).`
              : `${item.productName}: stock parcial (${fromStock} de ${pending}); faltan ${toProduce} por producir.`,
          severity: 'warning',
          itemIndex: index,
        });
      }

      const productionTask = tasks.find(
        (task) =>
          task.taskType === TaskType.PRODUCTION &&
          task.orderItemIndex === index &&
          task.status !== PrintJobStatus.CANCELADO,
      );
      if (
        productionTask?.status === PrintJobStatus.BLOQUEADO &&
        productionTask.blockedReason
      ) {
        alerts.push({
          code: 'production_blocked',
          message: `${item.productName}: ${productionTask.blockedReason}.`,
          severity: 'warning',
          itemIndex: index,
        });
      }
    });

    return alerts;
  }

  archiveTasksForOrder(orderId: string): void {
    for (const job of this.getTasksForOrder(orderId)) {
      job.active = false;
      job.archived = true;
    }
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
      return OrderStatus.PENDIENTE;
    }

    if (openTasks.every((task) => task.status === PrintJobStatus.TERMINADO)) {
      return OrderStatus.TERMINADO;
    }

    if (openTasks.some((task) => this.isTaskInProgress(task))) {
      return OrderStatus.EN_PROGRESO;
    }

    return OrderStatus.PENDIENTE;
  }

  private isTaskInProgress(task: PrintJob): boolean {
    return (
      task.status === PrintJobStatus.EN_PROCESO ||
      task.status === PrintJobStatus.EN_REVISION
    );
  }

  private isTaskInProduction(task: PrintJob): boolean {
    return this.isTaskInProgress(task);
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
      if (
        job.status !== PrintJobStatus.CANCELADO &&
        job.status !== PrintJobStatus.TERMINADO
      ) {
        job.status = PrintJobStatus.CANCELADO;
        job.active = false;
      }
    }

    this.releaseReservations(order);
  }

  private ensureFulfillment(item: OrderItem): void {
    item.deliveredQuantity ??= 0;
    item.reservedQuantity ??= 0;
    item.productionRequiredQuantity ??= 0;
    item.producedQuantity ??= 0;
    item.deliveredFromProductionQuantity ??= 0;
  }

  private ensurePrepareTask(order: Order): void {
    const existing = this.store.printJobs.find(
      (job) =>
        job.orderId === order.id && job.taskType === TaskType.PREPARE_ORDER,
    );
    if (existing) {
      existing.customerName = order.customerName;
      existing.productName = `Preparar pedido #${order.id}`;
      existing.dueDate = order.dueDate;
      existing.archived = false;
      return;
    }

    this.store.printJobs.push({
      id: this.store.nextId('job', this.store.printJobs),
      orderId: order.id,
      orderItemIndex: -1,
      customerName: order.customerName,
      productName: `Preparar pedido #${order.id}`,
      type: order.services[0] ?? ServiceType.IMPRESION_3D,
      taskType: TaskType.PREPARE_ORDER,
      quantity: 1,
      status: PrintJobStatus.BLOQUEADO,
      blockedReason: 'Esperando inicio de preparación',
      active: false,
      archived: false,
      priority: this.calcPriority(order.dueDate),
      machine: 'Ventas',
      estimatedHours: 1,
      dueDate: order.dueDate,
    });
  }

  private ensureItemTask(
    order: Order,
    item: OrderItem,
    itemIndex: number,
    taskType: TaskType,
  ): PrintJob {
    const existing = this.store.printJobs.find(
      (job) =>
        job.orderId === order.id &&
        job.orderItemIndex === itemIndex &&
        job.taskType === taskType,
    );
    if (existing) {
      if (existing.status === PrintJobStatus.CANCELADO) {
        existing.status = PrintJobStatus.POR_HACER;
        existing.active = false;
        existing.blockedReason = undefined;
      }
      existing.quantity =
        taskType === TaskType.PRODUCTION
          ? item.productionRequiredQuantity
          : item.quantity;
      this.updateTaskMetadata(existing, order, item, itemIndex, taskType);
      if (taskType === TaskType.PRODUCTION) {
        existing.productName = this.productionTaskName(item);
        if (item.productId && !this.hasProductionSupplies(existing)) {
          existing.status = PrintJobStatus.BLOQUEADO;
          existing.blockedReason = 'Insumos insuficientes';
        } else if (
          existing.status === PrintJobStatus.BLOQUEADO &&
          existing.blockedReason === 'Insumos insuficientes'
        ) {
          existing.status = PrintJobStatus.POR_HACER;
          existing.blockedReason = undefined;
        }
      }
      existing.archived = false;
      return existing;
    }

    const task = this.createTask(order, item, itemIndex, taskType);
    task.taskType = taskType;
    task.quantity =
      taskType === TaskType.PRODUCTION
        ? item.productionRequiredQuantity
        : item.quantity;
    task.productName =
      taskType === TaskType.PRODUCTION
        ? this.productionTaskName(item, task.quantity)
        : item.productName;
    task.archived = false;
    if (
      taskType === TaskType.PRODUCTION &&
      item.productId &&
      !this.hasProductionSupplies(task)
    ) {
      task.status = PrintJobStatus.BLOQUEADO;
      task.blockedReason = 'Insumos insuficientes';
    }
    this.store.printJobs.push(task);
    return task;
  }

  private planDesignPrintFulfillment(
    order: Order,
    item: OrderItem,
    index: number,
  ): void {
    this.ensureFulfillment(item);
    const pending = Math.max(
      item.quantity - (item.deliveredQuantity ?? 0),
      0,
    );
    item.productionRequiredQuantity = Math.max(
      pending - (item.producedQuantity ?? 0),
      0,
    );

    if (item.productionRequiredQuantity > 0) {
      this.ensureItemTask(order, item, index, TaskType.PRODUCTION);
    } else {
      this.cancelOpenProductionTask(order.id, index);
    }
  }

  private planCustomFdmFulfillment(
    order: Order,
    item: OrderItem,
    index: number,
  ): void {
    this.ensureFulfillment(item);
    const pending = Math.max(
      item.quantity - (item.deliveredQuantity ?? 0),
      0,
    );
    item.productionRequiredQuantity = Math.max(
      pending - (item.producedQuantity ?? 0),
      0,
    );

    if (item.productionRequiredQuantity > 0) {
      this.ensureItemTask(order, item, index, TaskType.PRODUCTION);
    } else {
      this.cancelOpenProductionTask(order.id, index);
    }
  }

  private planCatalogItemFulfillment(
    order: Order,
    item: OrderItem,
    index: number,
    options?: { reserve?: boolean },
  ): void {
    if (!item.productId) return;

    this.ensureFulfillment(item);
    const product = this.store.getProductById(item.productId);
    if (!product) return;

    const pending = Math.max(
      item.quantity - (item.deliveredQuantity ?? 0),
      0,
    );
    const available = this.getAvailableStock(item.productId, order.id);
    const produced = item.producedQuantity ?? 0;
    const fromStock = Math.min(pending, Math.max(available, 0));
    const reserve = options?.reserve ?? this.isPreparationStarted(order);

    item.productionRequiredQuantity = Math.max(
      pending - fromStock - produced,
      0,
    );
    item.reservedQuantity = reserve ? fromStock : 0;

    if (reserve && item.productionRequiredQuantity > 0) {
      this.ensureItemTask(order, item, index, TaskType.PRODUCTION);
    } else if (!reserve || item.productionRequiredQuantity <= 0) {
      this.cancelOpenProductionTask(order.id, index);
    }
  }

  private cancelOpenProductionTask(orderId: string, itemIndex: number): void {
    const job = this.store.printJobs.find(
      (candidate) =>
        candidate.orderId === orderId &&
        candidate.orderItemIndex === itemIndex &&
        candidate.taskType === TaskType.PRODUCTION &&
        candidate.status !== PrintJobStatus.TERMINADO &&
        candidate.status !== PrintJobStatus.CANCELADO,
    );
    if (!job) return;
    job.status = PrintJobStatus.CANCELADO;
    job.active = false;
  }

  private getAvailableStock(productId: string, excludeOrderId: string): number {
    return buildProductStockOverview(this.store, productId, {
      excludeOrderId,
    }).available;
  }

  private reserveStockAndCreateProduction(orderId: string): void {
    const order = this.store.getOrderById(orderId);
    if (!order) return;

    order.items.forEach((item, index) => {
      if (!item.productId) return;
      this.planCatalogItemFulfillment(order, item, index, { reserve: true });
    });
  }

  private prepareStillHasOpenWork(orderId: string, prepareJobId: string): boolean {
    return this.getTasksForOrder(orderId).some(
      (task) =>
        task.id !== prepareJobId &&
        task.status !== PrintJobStatus.TERMINADO &&
        task.status !== PrintJobStatus.CANCELADO,
    );
  }

  private isPreparationStarted(order: Order): boolean {
    const prepare = this.store.printJobs.find(
      (job) =>
        job.orderId === order.id && job.taskType === TaskType.PREPARE_ORDER,
    );
    if (!prepare) return false;
    return (
      prepare.status === PrintJobStatus.EN_PROCESO ||
      prepare.status === PrintJobStatus.EN_REVISION ||
      prepare.status === PrintJobStatus.TERMINADO
    );
  }

  private hasProductionSupplies(job: PrintJob): boolean {
    if (!job.productId) return true;
    const product = this.store.getProductById(job.productId);
    if (!product) return false;
    const quantity = Math.max(job.quantity ?? 1, 1);

    if (product.type === ProductType.FDM) {
      const lines =
        product.filaments?.length
          ? product.filaments
          : product.filamentType
            ? [{ filamentType: product.filamentType, grams: product.grams }]
            : [];
      return lines.every((line) => {
        const availableGrams = this.store.supplies
          .filter(
            (supply) =>
              supply.category === SupplyCategory.FDM &&
              supply.filamentType === line.filamentType &&
              this.supplyMatchesColor(supply, line.colorId),
          )
          .reduce((sum, supply) => sum + supply.quantity * 1000, 0);
        return availableGrams >= line.grams * quantity;
      });
    }

    if (product.type === ProductType.RESINA && product.resinType) {
      const availableMl = this.store.supplies
        .filter(
          (supply) =>
            supply.category === SupplyCategory.RESINA &&
            supply.resinType === product.resinType &&
            this.supplyMatchesColor(supply, product.colorId),
        )
        .reduce((sum, supply) => sum + supply.quantity * 1000, 0);
      return availableMl >= product.grams * quantity;
    }

    return true;
  }

  private supplyMatchesColor(supply: Supply, colorId?: string): boolean {
    if (isIndistintoColor(colorId)) {
      return true;
    }
    return supply.colorId === colorId;
  }

  private cancelStaleTasks(order: Order): void {
    for (const job of this.getTasksForOrder(order.id)) {
      if (
        job.taskType === TaskType.SERVICE &&
        (job.orderItemIndex < 0 ||
          !order.items[job.orderItemIndex] ||
          order.items[job.orderItemIndex]?.productId)
      ) {
        if (job.status !== PrintJobStatus.TERMINADO) {
          job.status = PrintJobStatus.CANCELADO;
          job.active = false;
        }
      }
    }
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

  private createTask(
    order: Order,
    item: OrderItem,
    itemIndex: number,
    taskType: TaskType,
  ): PrintJob {
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
      machine: this.defaultMachine(item, taskType),
      estimatedHours: this.estimateHours(item, taskType),
      dueDate: order.dueDate,
    };
  }

  private productionTaskName(item: OrderItem, quantity?: number): string {
    return buildProductionTaskName(item, quantity);
  }


  private updateTaskMetadata(
    job: PrintJob,
    order: Order,
    item: OrderItem,
    itemIndex: number,
    taskType: TaskType = job.taskType ?? TaskType.SERVICE,
  ): void {
    job.orderItemIndex = itemIndex;
    job.customerName = order.customerName;
    job.productName =
      taskType === TaskType.PRODUCTION
        ? this.productionTaskName(item, job.quantity)
        : item.productName;
    job.productId = item.productId;
    job.type = item.serviceType;
    job.dueDate = order.dueDate;
    job.priority = this.calcPriority(order.dueDate);
    job.machine = this.defaultMachine(item, taskType);
    job.estimatedHours = this.estimateHours(item, taskType);
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
    return calcTaskPriority(dueDate);
  }

  private defaultMachine(
    item: OrderItem,
    taskType: TaskType = TaskType.SERVICE,
  ): string {
    return defaultTaskMachine(item, taskType, this.store.products);
  }

  private estimateHours(
    item: OrderItem,
    taskType: TaskType = TaskType.SERVICE,
  ): number {
    return estimateTaskHours(item, taskType, this.store.products);
  }
}
