import { Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, PrintJobStatus } from '../common/enums';
import {
  PrintJob,
  PrintJobActor,
  PrintJobsBoard,
  UpdatePrintJobDto,
} from '../common/interfaces';
import {
  assertPrintJobStatus,
  assertPrintJobStatusTransition,
} from '../common/validators/domain.validators';
import { OrderTasksService } from './order-tasks.service';
import { StoreService } from '../store/store.service';

export interface PrintJobUpdateResult extends PrintJob {
  orderStatus: OrderStatus;
}

@Injectable()
export class PrintJobsService {
  constructor(
    private readonly store: StoreService,
    private readonly orderTasks: OrderTasksService,
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

    if (dto.status !== undefined) {
      assertPrintJobStatus(dto.status);
      assertPrintJobStatusTransition(job.status, dto.status);
      this.orderTasks.beforeStatusChange(job, dto.status, actor);
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

    this.orderTasks.afterStatusChange(job);

    const order = this.store.getOrderById(job.orderId);

    return {
      ...job,
      orderStatus: order?.status ?? OrderStatus.PENDIENTE,
    };
  }

  updateStatus(
    id: string,
    status: PrintJobStatus,
    actor?: PrintJobActor,
  ): PrintJobUpdateResult {
    return this.update(id, { status }, actor);
  }
}
