import { Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, PrintJobStatus } from '../common/enums';
import { PrintJob, PrintJobsBoard, UpdatePrintJobDto } from '../common/interfaces';
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
      .sort((a, b) => b.priority - a.priority);
  }

  getBoard(): PrintJobsBoard {
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
    if (!this.orderTasks.isVisibleInQueue(orderId)) {
      return [];
    }

    return this.store.printJobs
      .filter((job) => job.orderId === orderId)
      .sort((a, b) => a.orderItemIndex - b.orderItemIndex);
  }

  findOne(id: string): PrintJob {
    const job = this.store.getPrintJobById(id);
    if (!job) {
      throw new NotFoundException(`Trabajo ${id} no encontrado`);
    }
    return job;
  }

  update(id: string, dto: UpdatePrintJobDto): PrintJobUpdateResult {
    const job = this.findOne(id);

    if (dto.status !== undefined) {
      assertPrintJobStatus(dto.status);
      assertPrintJobStatusTransition(job.status, dto.status);
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

    if (dto.active !== undefined) {
      job.active = dto.active;
      if (
        !dto.active &&
        job.status !== PrintJobStatus.TERMINADO &&
        job.status !== PrintJobStatus.CANCELADO
      ) {
        job.status = PrintJobStatus.POR_HACER;
        job.startedAt = undefined;
        job.completedAt = undefined;
      }
    }

    this.orderTasks.syncOrderStatusFromTasks(job.orderId);

    const order = this.store.getOrderById(job.orderId);

    return {
      ...job,
      orderStatus: order?.status ?? OrderStatus.PENDIENTE,
    };
  }

  updateStatus(id: string, status: PrintJobStatus): PrintJobUpdateResult {
    return this.update(id, { status });
  }
}
