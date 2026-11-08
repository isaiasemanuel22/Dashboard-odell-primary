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
  CreateIndependentTaskDto,
  RegisterPrintJobFailureDto,
} from '../common/dto';
import {
  PrintJob,
  PrintJobActor,
  PrintJobConsumptionLine,
  PrintJobsBoard,
  UpdatePrintJobDto,
} from '../common/interfaces';
import {
  assertPrintJobStatus,
  assertPrintJobStatusTransition,
} from '../common/validators/domain.validators';
import { CostCalculatorService } from '../settings/cost-calculator.service';
import { StoreChangeService } from '../store/store-change.service';
import { StoreService } from '../store/store.service';
import {
  effectiveTaskPriority,
  priorityOverrideFromDto,
} from './order-task-estimate';
import { OrderTasksService } from './order-tasks.service';
import {
  FAILURE_REASONS,
  PrintJobFailureEntry,
} from './print-job-failures.util';

export interface PrintJobUpdateResult extends PrintJob {
  orderStatus: OrderStatus;
  stockWarnings?: string[];
}

export interface PrintJobFailureResult {
  job: PrintJob;
  reprint?: PrintJob;
}

export interface PrintJobFailureStats {
  prints: number;
  failed: number;
  failedPercent: number | null;
  lostGrams: number;
  lostCost: number;
  errorMarginPercent: number;
  suggestedPercent: number | null;
}

@Injectable()
export class PrintJobsService {
  constructor(
    private readonly store: StoreService,
    private readonly orderTasks: OrderTasksService,
    private readonly storeChange?: StoreChangeService,
    private readonly costCalculator?: CostCalculatorService,
  ) {}

  findAll(): PrintJob[] {
    return [...this.store.printJobs]
      .filter((job) => this.orderTasks.isVisibleInQueue(job.orderId))
      .filter((job) => !job.archived)
      .sort((a, b) => b.priority - a.priority);
  }

  getBoard(): PrintJobsBoard {
    this.orderTasks.blockTasksMissingStock();
    const jobs = this.findAll();
    const orderStatuses: Record<string, OrderStatus> = {};

    for (const job of jobs) {
      if (orderStatuses[job.orderId]) continue;
      const order = this.store.getOrderById(job.orderId);
      if (order) {
        orderStatuses[job.orderId] = order.status;
      }
    }

    return { jobs, orderStatuses };
  }

  findByOrderId(orderId: string): PrintJob[] {
    return this.store.printJobs
      .filter((job) => job.orderId === orderId)
      .sort((a, b) => a.orderItemIndex - b.orderItemIndex);
  }

  supplyShortages(id: string) {
    return this.orderTasks.describeSupplyShortages(this.findOne(id));
  }

  describeConsumption(id: string): PrintJobConsumptionLine[] {
    return this.orderTasks.describeConsumption(this.findOne(id));
  }

  blockMissingSupplies(): boolean {
    return this.orderTasks.blockTasksMissingStock();
  }

  findOne(id: string): PrintJob {
    const job = this.store.getPrintJobById(id);
    if (!job) {
      throw new NotFoundException(`Trabajo ${id} no encontrado`);
    }
    return job;
  }

  update(
    id: string,
    dto: UpdatePrintJobDto,
    actor?: PrintJobActor,
  ): PrintJobUpdateResult {
    const job = this.findOne(id);

    if (dto.supplyReplacements) {
      this.orderTasks.applySupplyReplacements(job, dto.supplyReplacements);
    }

    if (dto.notes !== undefined) {
      job.notes = dto.notes.trim().slice(0, 2000) || undefined;
    }

    if (dto.actualHours !== undefined) {
      if (dto.actualHours === null) {
        job.actualHours = null;
      } else {
        const hours = Number(dto.actualHours);
        if (!Number.isFinite(hours) || hours < 0 || hours > 1000) {
          throw new BadRequestException(
            'Las horas reales deben estar entre 0 y 1000',
          );
        }
        job.actualHours = hours;
      }
    }

    if (dto.priority !== undefined) {
      const override = priorityOverrideFromDto(dto.priority);
      job.priorityOverride = override === null ? null : override;
      job.priority = effectiveTaskPriority(job.dueDate, job.priorityOverride);
    }

    if (dto.status !== undefined) {
      assertPrintJobStatus(dto.status);
      assertPrintJobStatusTransition(job.status, dto.status);
      this.orderTasks.beforeStatusChange(job, dto.status, actor, {
        blockedReason: dto.blockedReason,
      });
      job.status = dto.status;
      if (dto.status !== PrintJobStatus.POR_HACER) {
        job.active = true;
      }
      if (dto.status === PrintJobStatus.EN_PROCESO && !job.startedAt) {
        job.startedAt = new Date().toISOString();
      }
      if (dto.status === PrintJobStatus.TERMINADO) {
        job.completedAt = new Date().toISOString();
      }
      if (
        dto.status !== PrintJobStatus.TERMINADO &&
        dto.status !== PrintJobStatus.CANCELADO
      ) {
        job.completedAt = undefined;
      }
    }

    if (dto.responsibleUserId !== undefined) {
      const nextResponsible = dto.responsibleUserId.trim() || undefined;
      if (nextResponsible !== job.responsibleUserId) {
        this.orderTasks.assertActorCanMove(job, actor);
      }
      job.responsibleUserId = nextResponsible;
      job.responsibleManual = true;
    }

    if (dto.active !== undefined) {
      const resetsToTodo =
        dto.status === undefined &&
        !dto.active &&
        job.status !== PrintJobStatus.TERMINADO &&
        job.status !== PrintJobStatus.CANCELADO &&
        job.status !== PrintJobStatus.BLOQUEADO;
      if (resetsToTodo) {
        this.orderTasks.beforeStatusChange(
          job,
          PrintJobStatus.POR_HACER,
          actor,
        );
      }
      job.active = dto.active;
      if (
        !dto.active &&
        job.status !== PrintJobStatus.TERMINADO &&
        job.status !== PrintJobStatus.CANCELADO &&
        job.status !== PrintJobStatus.BLOQUEADO
      ) {
        job.status = PrintJobStatus.POR_HACER;
        job.startedAt = undefined;
        job.completedAt = undefined;
      }
    }

    const stockWarnings = this.orderTasks.afterStatusChange(job);

    const order = this.store.getOrderById(job.orderId);

    this.storeChange?.recordChange({
      collections: ['printJobs', 'orders'],
      realtime: {
        scopes: ['print-jobs', 'orders', 'dashboard'],
        action: 'update',
        entity: 'print-job',
        id: job.id,
      },
    });

    return {
      ...job,
      orderStatus: order?.status ?? OrderStatus.PENDIENTE,
      ...(stockWarnings.length ? { stockWarnings } : {}),
    };
  }

  updateStatus(
    id: string,
    status: PrintJobStatus,
    actor?: PrintJobActor,
    blockedReason?: string,
  ): PrintJobUpdateResult {
    return this.update(id, { status, blockedReason }, actor);
  }

  registerFailure(
    id: string,
    dto: RegisterPrintJobFailureDto,
    actor?: PrintJobActor,
  ): PrintJobFailureResult {
    const job = this.findOne(id);
    this.orderTasks.assertActorCanMove(job, actor);

    if (!FAILURE_REASONS.includes(dto.reason)) {
      throw new BadRequestException('Motivo de falla inválido');
    }

    const pieces = Math.round(Number(dto.pieces));
    const grams = Number(dto.grams);
    const hours = Number(dto.hours);
    if (!Number.isInteger(pieces) || pieces < 1 || pieces > 1000) {
      throw new BadRequestException(
        'Las piezas deben ser un entero entre 1 y 1000',
      );
    }
    if (!Number.isFinite(grams) || grams < 0 || grams > 100000) {
      throw new BadRequestException('Los gramos deben estar entre 0 y 100000');
    }
    if (!Number.isFinite(hours) || hours < 0 || hours > 1000) {
      throw new BadRequestException('Las horas deben estar entre 0 y 1000');
    }

    const cost = this.costCalculator
      ? this.costCalculator.calculateFailureCost(job, grams, hours)
      : 0;

    const entry: PrintJobFailureEntry = {
      id: `fail-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      at: new Date().toISOString(),
      userId: actor?.userId,
      pieces,
      grams,
      hours,
      reason: dto.reason,
      cost,
    };
    this.orderTasks.appendFailure(job, entry);

    let reprint: PrintJob | undefined;
    if (dto.reprint) {
      reprint = this.orderTasks.createReprint(job, pieces);
    }

    this.storeChange?.recordChange({
      collections: ['printJobs'],
      realtime: {
        scopes: ['print-jobs', 'orders', 'dashboard'],
        action: 'update',
        entity: 'print-job',
        id: job.id,
      },
    });

    return { job, reprint };
  }

  failureStats(): PrintJobFailureStats {
    const now = Date.now();
    const windowMs = 30 * 24 * 60 * 60 * 1000;
    const since = now - windowMs;

    let prints = 0;
    let failed = 0;
    let lostGrams = 0;
    let lostCost = 0;

    for (const job of this.store.printJobs) {
      if (
        job.taskType === TaskType.PRODUCTION &&
        job.type === ServiceType.IMPRESION_3D &&
        job.status === PrintJobStatus.TERMINADO &&
        job.completedAt
      ) {
        const completed = new Date(job.completedAt).getTime();
        if (!Number.isNaN(completed) && completed >= since) {
          prints += Math.max(0, Number(job.quantity) || 0);
        }
      }

      for (const entry of job.failures ?? []) {
        const at = new Date(entry.at).getTime();
        if (Number.isNaN(at) || at < since) continue;
        failed += Math.max(0, Number(entry.pieces) || 0);
        lostGrams += Math.max(0, Number(entry.grams) || 0);
        lostCost += Math.max(0, Number(entry.cost) || 0);
      }
    }

    const denom = prints + failed;
    const failedPercent =
      denom > 0 ? Math.round((failed / denom) * 1000) / 10 : null;
    const errorMarginPercent =
      Number(this.store.generalSettings.errorMarginPercent) || 0;
    const suggestedPercent =
      denom >= 20 && failedPercent != null ? Math.round(failedPercent) : null;

    return {
      prints,
      failed,
      failedPercent,
      lostGrams: Math.round(lostGrams * 10) / 10,
      lostCost: Math.round(lostCost),
      errorMarginPercent,
      suggestedPercent,
    };
  }

  /** Tarea interna, sin pedido. Terminarla no mueve stock. */
  createIndependent(
    dto: CreateIndependentTaskDto,
    actor?: PrintJobActor,
  ): PrintJob {
    const productName = dto.productName?.trim();
    if (!productName) {
      throw new BadRequestException('La tarea necesita un nombre');
    }
    const dueDate = resolveDueDate(dto.dueDate);
    const type = independentTaskType(dto.type);
    const job: PrintJob = {
      id: this.store.nextId('job', this.store.printJobs),
      orderId: '',
      orderItemIndex: -1,
      customerName: '',
      productName,
      type,
      taskType: TaskType.INTERNAL,
      quantity: 1,
      status: PrintJobStatus.POR_HACER,
      active: true,
      priority: effectiveTaskPriority(dueDate),
      machine: machineForIndependentTask(type),
      estimatedHours: Math.max(0, Number(dto.estimatedHours) || 1),
      dueDate,
      responsibleUserId:
        dto.responsibleUserId?.trim() || actor?.userId || undefined,
      responsibleManual: !!dto.responsibleUserId?.trim(),
    };
    this.store.printJobs.push(job);
    this.storeChange?.recordChange({
      collections: ['printJobs'],
      realtime: {
        scopes: ['print-jobs', 'dashboard'],
        action: 'create',
        entity: 'print-job',
        id: job.id,
      },
    });
    return job;
  }
}

function resolveDueDate(value: string | undefined): string {
  const trimmed = value?.trim();
  if (trimmed && !Number.isNaN(new Date(trimmed).getTime())) {
    return trimmed;
  }
  const due = new Date();
  due.setDate(due.getDate() + 7);
  return due.toISOString().slice(0, 10);
}

function independentTaskType(
  type: string | null | undefined,
): ServiceType | '' {
  const value = type?.trim() ?? '';
  if (value === 'modelado') return ServiceType.MODELADO;
  if (value === 'diseno_grafico') return ServiceType.DISENO_GRAFICO;
  if (value === 'estampado') return ServiceType.ESTAMPADO;
  if (value === 'impresion_3d') return ServiceType.IMPRESION_3D;
  return '';
}

function machineForIndependentTask(type: ServiceType | ''): string {
  if (type === ServiceType.MODELADO) return 'Modelado 3D';
  if (type === ServiceType.DISENO_GRAFICO) return 'Diseño gráfico';
  if (type === ServiceType.ESTAMPADO) return 'Estampado';
  if (type === ServiceType.IMPRESION_3D) return 'Impresión 3D';
  return '';
}
