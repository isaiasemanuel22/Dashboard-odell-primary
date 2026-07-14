import { PrintJob } from '../../common/interfaces';

export function mapPrintJobFromDb(row: {
  id: string;
  orderId: string;
  orderItemIndex: number;
  customerName: string;
  productName: string;
  productId: string | null;
  type: string;
  status: string;
  active: boolean;
  priority: number;
  machine: string;
  estimatedHours: number;
  dueDate: Date;
  startedAt: Date | null;
  completedAt: Date | null;
}): PrintJob {
  return {
    id: row.id,
    orderId: row.orderId,
    orderItemIndex: row.orderItemIndex,
    customerName: row.customerName,
    productName: row.productName,
    productId: row.productId ?? undefined,
    type: row.type as PrintJob['type'],
    status: row.status as PrintJob['status'],
    active: row.active,
    priority: row.priority,
    machine: row.machine,
    estimatedHours: row.estimatedHours,
    dueDate: row.dueDate.toISOString(),
    startedAt: row.startedAt?.toISOString(),
    completedAt: row.completedAt?.toISOString(),
  };
}

export function mapPrintJobToDb(job: PrintJob) {
  return {
    id: job.id,
    orderId: job.orderId,
    orderItemIndex: job.orderItemIndex,
    customerName: job.customerName,
    productName: job.productName,
    productId: job.productId ?? null,
    type: job.type,
    status: job.status,
    active: job.active,
    priority: job.priority,
    machine: job.machine,
    estimatedHours: job.estimatedHours,
    dueDate: new Date(job.dueDate),
    startedAt: job.startedAt ? new Date(job.startedAt) : null,
    completedAt: job.completedAt ? new Date(job.completedAt) : null,
  };
}
