import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  OnModuleInit,
} from '@nestjs/common';
import {
  OrderStatus,
  PrintJobStatus,
  ProductType,
  ServiceType,
  SupplyCategory,
  TaskType,
} from '../common/enums';
import {
  EstampadoSupplyLine,
  Order,
  OrderItem,
  OrderAlert,
  PrintJob,
  PrintJobActor,
  Product3D,
  Supply,
  SupplyReplacement,
  SupplyShortageReport,
} from '../common/interfaces';
import { findColorById, isIndistintoColor } from '../common/color.util';
import { appendOrderStatusHistory } from '../orders/order-status-history.util';
import { StoreChangeService } from '../store/store-change.service';
import { StoreService } from '../store/store.service';
import { isAreaService } from '../common/service-type.util';
import { isDesignPrintConfigured } from '../orders/design-print.util';
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

interface MaterialRequirement {
  key: string;
  category: SupplyCategory;
  label: string;
  requiredUnits: number;
  coveredNaturally: boolean;
}

@Injectable()
export class OrderTasksService implements OnModuleInit {
  constructor(
    private readonly store: StoreService,
    private readonly storeChange?: StoreChangeService,
  ) {}

  onModuleInit(): void {
    const before = this.workFingerprint();
    this.syncAll();
    if (this.storeChange && before !== this.workFingerprint()) {
      this.storeChange.recordChange({
        collections: ['printJobs', 'orders'],
        realtime: {
          scopes: ['print-jobs', 'orders', 'dashboard'],
          action: 'update',
          entity: 'print-job',
        },
      });
    }
  }

  private workFingerprint(): string {
    const jobs = this.store.printJobs
      .map((job) => `${job.id}:${job.status}:${job.blockedReason ?? ''}`)
      .join('|');
    const orders = this.store.orders
      .map((order) => `${order.id}:${order.status}`)
      .join('|');
    return `${jobs}#${orders}`;
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
      if (!isAreaService(item.serviceType)) {
        this.cancelOpenItemTasks(order.id, index);
        return;
      }
      if (item.productId) {
        this.planCatalogItemFulfillment(order, item, index);
        return;
      }
      this.ensureItemTask(order, item, index, TaskType.SERVICE);
      if (isDesignPrintConfigured(item)) {
        this.planDesignPrintFulfillment(order, item, index);
      } else if (isCustomFdmOrderLine(item) && isFdmQuoteConfigured(item)) {
        this.planCustomFdmFulfillment(order, item, index);
      } else {
        this.cancelOpenProductionTask(order.id, index);
      }
    });

    if (order.items.some((item) => !!item.productId)) {
      this.ensurePrepareTask(order);
    }

    this.cancelStaleTasks(order);
    this.assignOpenTasksResponsible(order);
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
    actor?: PrintJobActor,
  ): void {
    if (next !== job.status) {
      this.assertActorCanMove(job, actor);
    }

    if (
      job.status === PrintJobStatus.BLOQUEADO &&
      next !== PrintJobStatus.BLOQUEADO &&
      job.taskType === TaskType.PRODUCTION
    ) {
      if (!this.hasProductionSupplies(job)) {
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

  /**
   * Revisa los insumos que ya están en 0 y bloquea las tareas de Por hacer
   * y En progreso que los necesitan. La leyenda queda en «Insumos insuficientes».
   */
  blockTasksMissingStock(): boolean {
    let changed = false;
    for (const supply of this.store.supplies) {
      if (this.blockTasksForDepletedSupply(supply)) changed = true;
    }
    if (changed && this.storeChange) {
      this.storeChange.recordChange({
        collections: ['printJobs', 'orders'],
        realtime: {
          scopes: ['print-jobs', 'orders', 'dashboard'],
          action: 'update',
          entity: 'print-job',
        },
      });
    }
    return changed;
  }

  /**
   * El stock de este insumo quedó en 0. Las tareas de Por hacer y En progreso
   * que lo necesitan pasan a bloqueadas. No desbloquea nada: reponer solo notifica.
   */
  blockTasksForDepletedSupply(supply: Supply): boolean {
    if (Number(supply.quantity) > 1e-9) return false;

    const orderIds = new Set<string>();
    let changed = false;
    for (const job of this.store.printJobs) {
      if (!this.isOpenSupplyTask(job)) continue;
      if (!this.taskNeedsDepletedSupply(job, supply)) continue;
      job.status = PrintJobStatus.BLOQUEADO;
      job.blockedReason = 'Insumos insuficientes';
      job.suppliesAvailableNotifiedAt = undefined;
      orderIds.add(job.orderId);
      changed = true;
    }

    for (const orderId of orderIds) {
      this.syncOrderStatusFromTasks(orderId);
    }
    return changed;
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
    return status === OrderStatus.ENTREGADO || status === OrderStatus.CANCELADO;
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
      responsibleUserId: order.responsibleUserId?.trim() || undefined,
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
        if (
          item.productId &&
          this.analyzesSupplyStock(existing) &&
          !this.hasProductionSupplies(existing)
        ) {
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
    const pending = Math.max(item.quantity - (item.deliveredQuantity ?? 0), 0);
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
    const pending = Math.max(item.quantity - (item.deliveredQuantity ?? 0), 0);
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

    const pending = Math.max(item.quantity - (item.deliveredQuantity ?? 0), 0);
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

  /** Insumo suelto y servicio de un tercero no generan tarea (§11). */
  private cancelOpenItemTasks(orderId: string, itemIndex: number): void {
    for (const job of this.store.printJobs) {
      if (job.orderId !== orderId || job.orderItemIndex !== itemIndex) continue;
      if (
        job.status === PrintJobStatus.TERMINADO ||
        job.status === PrintJobStatus.CANCELADO
      ) {
        continue;
      }
      job.status = PrintJobStatus.CANCELADO;
      job.active = false;
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

  private prepareStillHasOpenWork(
    orderId: string,
    prepareJobId: string,
  ): boolean {
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

  describeSupplyShortages(job: PrintJob): SupplyShortageReport {
    const requirements = this.materialRequirements(job);
    const missing = requirements.filter((item) => !item.coveredNaturally);
    const categories = new Set(missing.map((item) => item.category));
    const candidates = this.store.supplies
      .filter(
        (supply) => categories.has(supply.category) && supply.quantity > 0,
      )
      .map((supply) => ({
        id: supply.id,
        name: supply.name,
        category: supply.category,
        detail: this.supplyStockLabel(supply),
      }));
    return {
      missing: missing.map((item) => ({
        key: item.key,
        label: item.label,
        category: item.category,
      })),
      candidates,
    };
  }

  /**
   * Guarda los reemplazos de esta tarea. Cada faltante natural tiene que
   * quedar cubierto por un insumo de la misma categoría con stock suficiente.
   */
  applySupplyReplacements(
    job: PrintJob,
    replacements: SupplyReplacement[],
  ): void {
    const requirements = this.materialRequirements(job);
    const byKey = new Map(requirements.map((item) => [item.key, item]));
    const next: SupplyReplacement[] = [];

    for (const item of replacements) {
      const requirement = byKey.get(item.requirementKey);
      if (!requirement) {
        throw new BadRequestException(
          'El insumo a reemplazar no corresponde a esta tarea',
        );
      }
      const supply = this.store.getSupplyById(item.supplyId);
      if (!supply || supply.category !== requirement.category) {
        throw new BadRequestException(
          'El reemplazo tiene que ser un insumo de la misma categoría',
        );
      }
      if (this.stockUnits(supply) < requirement.requiredUnits) {
        throw new BadRequestException(
          `${supply.name} no alcanza para reemplazar ${requirement.label}`,
        );
      }
      next.push({
        requirementKey: requirement.key,
        supplyId: supply.id,
      });
    }

    const pending = requirements.filter(
      (item) => !item.coveredNaturally && !next.some((row) => row.requirementKey === item.key),
    );
    if (pending.length) {
      throw new BadRequestException(
        'Falta reemplazar todos los insumos',
      );
    }

    job.supplyReplacements = next.length ? next : undefined;
  }

  /** Solo Por hacer y En progreso se revisan por falta de insumos. */
  private analyzesSupplyStock(job: PrintJob): boolean {
    return (
      job.status === PrintJobStatus.POR_HACER ||
      job.status === PrintJobStatus.EN_PROCESO
    );
  }

  private isOpenSupplyTask(job: PrintJob): boolean {
    if (job.archived) return false;
    if (
      job.taskType !== TaskType.PRODUCTION &&
      job.taskType !== TaskType.INTERNAL
    ) {
      return false;
    }
    return this.analyzesSupplyStock(job);
  }

  private taskNeedsDepletedSupply(job: PrintJob, supply: Supply): boolean {
    const tied =
      this.catalogLinesNeedSupply(job, supply.id) ||
      this.replacementPointsAt(job, supply.id) ||
      this.materialMatchesSupply(job, supply);
    return tied && !this.hasProductionSupplies(job);
  }

  private catalogLinesNeedSupply(job: PrintJob, supplyId: string): boolean {
    return this.listedSupplyLines(job).some(
      (line) => line.supplyId === supplyId && Number(line.quantity) > 0,
    );
  }

  private replacementPointsAt(job: PrintJob, supplyId: string): boolean {
    return !!job.supplyReplacements?.some((item) => item.supplyId === supplyId);
  }

  private materialMatchesSupply(job: PrintJob, supply: Supply): boolean {
    if (!job.productId) return false;
    const product = this.store.getProductById(job.productId);
    if (!product) return false;

    if (
      supply.category === SupplyCategory.FDM &&
      product.type === ProductType.FDM
    ) {
      const lines = product.filaments?.length
        ? product.filaments
        : product.filamentType
          ? [{ filamentType: product.filamentType, colorId: undefined }]
          : [];
      return lines.some(
        (line) =>
          line.filamentType === supply.filamentType &&
          this.supplyMatchesColor(supply, line.colorId),
      );
    }

    if (
      supply.category === SupplyCategory.RESINA &&
      product.type === ProductType.RESINA
    ) {
      const resin = product as Product3D;
      return (
        !!resin.resinType &&
        resin.resinType === supply.resinType &&
        this.supplyMatchesColor(supply, resin.colorId)
      );
    }

    return false;
  }

  private listedSupplyLines(job: PrintJob): EstampadoSupplyLine[] {
    const lines: EstampadoSupplyLine[] = [];
    if (job.productId) {
      const product = this.store.getProductById(job.productId);
      if (product && 'supplies' in product && product.supplies?.length) {
        lines.push(...product.supplies);
      }
    }
    const item = this.orderItemOf(job);
    if (item?.estampadoSupplies?.length) {
      lines.push(...item.estampadoSupplies);
    }
    return lines;
  }

  private orderItemOf(job: PrintJob): OrderItem | undefined {
    if (job.orderItemIndex < 0) return undefined;
    return this.store.getOrderById(job.orderId)?.items[job.orderItemIndex];
  }

  private hasProductionSupplies(job: PrintJob): boolean {
    if (job.productId && !this.store.getProductById(job.productId)) return false;
    return this.materialRequirements(job).every((item) =>
      this.requirementCovered(job, item),
    );
  }

  private materialRequirements(job: PrintJob): MaterialRequirement[] {
    return [
      ...this.processMaterialRequirements(job),
      ...this.catalogSupplyRequirements(job),
    ];
  }

  private catalogSupplyRequirements(job: PrintJob): MaterialRequirement[] {
    const quantity = Math.max(job.quantity ?? 1, 1);
    const requiredBySupply = new Map<string, number>();
    for (const line of this.listedSupplyLines(job)) {
      const lineQuantity = Number(line.quantity);
      if (!(lineQuantity > 0) || !line.supplyId) continue;
      requiredBySupply.set(
        line.supplyId,
        (requiredBySupply.get(line.supplyId) ?? 0) + lineQuantity * quantity,
      );
    }

    const requirements: MaterialRequirement[] = [];
    for (const [supplyId, requiredUnits] of requiredBySupply) {
      const supply = this.store.getSupplyById(supplyId);
      requirements.push({
        key: `supply:${supplyId}`,
        category: supply?.category ?? SupplyCategory.GENERAL,
        label: supply
          ? this.materialLabel(
              supply.name,
              supply.colorId,
              `${requiredUnits} ${supply.unit}`,
            )
          : 'Insumo',
        requiredUnits,
        coveredNaturally: !!supply && this.stockUnits(supply) >= requiredUnits,
      });
    }
    return requirements;
  }

  private processMaterialRequirements(job: PrintJob): MaterialRequirement[] {
    if (!job.productId) return [];
    const product = this.store.getProductById(job.productId);
    if (!product) return [];
    const quantity = Math.max(job.quantity ?? 1, 1);

    if (product.type === ProductType.FDM) {
      const lines = product.filaments?.length
        ? product.filaments
        : product.filamentType
          ? [{ filamentType: product.filamentType, grams: product.grams, colorId: undefined }]
          : [];
      return lines.map((line, index) => {
        const requiredUnits = Math.max(line.grams || 0, 0) * quantity;
        const coveredNaturally =
          this.matchingStock(SupplyCategory.FDM, (supply) =>
            supply.filamentType === line.filamentType &&
            this.supplyMatchesColor(supply, line.colorId),
          ) >= requiredUnits;
        return {
          key: `fdm:${index}`,
          category: SupplyCategory.FDM,
          label: this.materialLabel(
            String(line.filamentType ?? 'Filamento'),
            line.colorId,
            `${requiredUnits} g`,
          ),
          requiredUnits,
          coveredNaturally,
        };
      });
    }

    if (product.type === ProductType.RESINA && product.resinType) {
      const requiredUnits = Math.max(product.grams || 0, 0) * quantity;
      const resin = product as Product3D;
      const coveredNaturally =
        this.matchingStock(SupplyCategory.RESINA, (supply) =>
          supply.resinType === resin.resinType &&
          this.supplyMatchesColor(supply, resin.colorId),
        ) >= requiredUnits;
      return [
        {
          key: 'resina',
          category: SupplyCategory.RESINA,
          label: this.materialLabel(
            String(resin.resinType),
            resin.colorId,
            `${requiredUnits} ml`,
          ),
          requiredUnits,
          coveredNaturally,
        },
      ];
    }

    return [];
  }

  private requirementCovered(
    job: PrintJob,
    requirement: MaterialRequirement,
  ): boolean {
    const replacement = job.supplyReplacements?.find(
      (item) => item.requirementKey === requirement.key,
    );
    if (!replacement) return requirement.coveredNaturally;
    const supply = this.store.getSupplyById(replacement.supplyId);
    return (
      !!supply &&
      supply.category === requirement.category &&
      this.stockUnits(supply) >= requirement.requiredUnits
    );
  }

  private matchingStock(
    category: SupplyCategory,
    matches: (supply: Supply) => boolean,
  ): number {
    return this.store.supplies
      .filter((supply) => supply.category === category && matches(supply))
      .reduce((sum, supply) => sum + this.stockUnits(supply), 0);
  }

  /** kg y L se comparan en g / ml. */
  private stockUnits(supply: Supply): number {
    if (
      supply.category === SupplyCategory.FDM ||
      supply.category === SupplyCategory.RESINA
    ) {
      return supply.quantity * 1000;
    }
    return supply.quantity;
  }

  private materialLabel(
    material: string,
    colorId: string | undefined,
    amount: string,
  ): string {
    const color = findColorById(
      this.store.generalSettings?.colors ?? [],
      colorId,
    );
    return [material, color?.name, amount].filter(Boolean).join(' · ');
  }

  private supplyStockLabel(supply: Supply): string {
    const color = findColorById(
      this.store.generalSettings?.colors ?? [],
      supply.colorId,
    );
    const amount =
      supply.category === SupplyCategory.FDM
        ? `${supply.quantity} kg`
        : supply.category === SupplyCategory.RESINA
          ? `${supply.quantity} L`
          : `${supply.quantity} ${supply.unit}`;
    return [supply.brand, color?.name, amount].filter(Boolean).join(' · ');
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
      responsibleUserId: order.responsibleUserId?.trim() || undefined,
    };
  }

  /**
   * El pedido es la fuente del responsable. Solo se pisa en tareas abiertas:
   * terminadas y canceladas conservan el que tenían. Sin responsable en el
   * pedido no se borra el de la tarea (pedidos viejos).
   */
  private assignOpenTasksResponsible(order: Order): void {
    const responsibleUserId = order.responsibleUserId?.trim();
    if (!responsibleUserId) return;

    for (const job of this.getTasksForOrder(order.id)) {
      if (
        job.status === PrintJobStatus.TERMINADO ||
        job.status === PrintJobStatus.CANCELADO
      ) {
        continue;
      }
      job.responsibleUserId = responsibleUserId;
    }
  }

  assertActorCanMove(job: PrintJob, actor?: PrintJobActor): void {
    if (actor?.isAdmin) return;
    if (actor?.userId && actor.userId === job.responsibleUserId) return;
    throw new ForbiddenException(
      'Solo el responsable de la tarea o un administrador puede cambiar su estado',
    );
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
