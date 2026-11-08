import { Prisma } from '@prisma/client';
import {
  ConsumedSpoolLine,
  PrintJob,
  PrintJobFailure,
  SupplyReplacement,
} from '../../common/interfaces';
import { fromJson, toInputJson } from '../../prisma/json.util';
import { parseFailures } from '../../print-jobs/print-job-failures.util';

function parseSupplyReplacements(
  raw?: string | null,
): SupplyReplacement[] | undefined {
  if (!raw?.trim()) return undefined;
  try {
    const parsed = JSON.parse(raw) as SupplyReplacement[];
    if (!Array.isArray(parsed)) return undefined;
    return parsed.filter(
      (item) =>
        item &&
        typeof item.requirementKey === 'string' &&
        typeof item.supplyId === 'string',
    );
  } catch {
    return undefined;
  }
}

function parseConsumedSpools(raw: unknown): ConsumedSpoolLine[] | undefined {
  const parsed = fromJson(raw ?? null);
  if (!Array.isArray(parsed)) return undefined;
  const lines = parsed.filter(
    (item): item is ConsumedSpoolLine =>
      !!item &&
      typeof item === 'object' &&
      typeof (item as ConsumedSpoolLine).spoolId === 'string' &&
      typeof (item as ConsumedSpoolLine).code === 'string' &&
      typeof (item as ConsumedSpoolLine).grams === 'number',
  );
  return lines.length ? lines : undefined;
}

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
  taskType?: string;
  quantity?: number;
  archived?: boolean;
  blockedReason?: string | null;
  responsibleUserId?: string | null;
  suppliesAvailableNotifiedAt?: Date | null;
  supplyReplacements?: string | null;
  printerId?: string | null;
  queuePosition?: number | null;
  notes?: string | null;
  actualHours?: number | null;
  priorityOverride?: number | null;
  responsibleManual?: boolean | null;
  failures?: string | null;
  reprintOfJobId?: string | null;
  consumedAt?: Date | null;
  consumedSpools?: unknown;
}): PrintJob {
  const failures = parseFailures(row.failures) as PrintJobFailure[];
  return {
    id: row.id,
    orderId: row.orderId,
    orderItemIndex: row.orderItemIndex,
    customerName: row.customerName,
    productName: row.productName,
    productId: row.productId ?? undefined,
    type: row.type ? (row.type as PrintJob['type']) : '',
    status: row.status as PrintJob['status'],
    active: row.active,
    priority: row.priority,
    machine: row.machine,
    estimatedHours: row.estimatedHours,
    dueDate: row.dueDate.toISOString(),
    startedAt: row.startedAt?.toISOString(),
    completedAt: row.completedAt?.toISOString(),
    taskType: (row.taskType ?? 'SERVICE') as PrintJob['taskType'],
    quantity: row.quantity ?? 1,
    archived: row.archived ?? false,
    blockedReason: row.blockedReason ?? undefined,
    responsibleUserId: row.responsibleUserId ?? undefined,
    suppliesAvailableNotifiedAt: row.suppliesAvailableNotifiedAt?.toISOString(),
    supplyReplacements: parseSupplyReplacements(row.supplyReplacements),
    printerId: row.printerId ?? null,
    queuePosition: row.queuePosition ?? null,
    notes: row.notes ?? undefined,
    actualHours: row.actualHours ?? null,
    priorityOverride: row.priorityOverride ?? null,
    responsibleManual: row.responsibleManual ?? false,
    failures: failures.length ? failures : undefined,
    reprintOfJobId: row.reprintOfJobId ?? null,
    consumedAt: row.consumedAt?.toISOString() ?? null,
    consumedSpools: parseConsumedSpools(row.consumedSpools),
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
    type: job.type || '',
    status: job.status,
    active: job.active,
    priority: job.priority,
    machine: job.machine,
    estimatedHours: job.estimatedHours,
    dueDate: new Date(job.dueDate),
    startedAt: job.startedAt ? new Date(job.startedAt) : null,
    completedAt: job.completedAt ? new Date(job.completedAt) : null,
    taskType: job.taskType ?? 'SERVICE',
    quantity: job.quantity ?? 1,
    archived: job.archived ?? false,
    blockedReason: job.blockedReason ?? null,
    responsibleUserId: job.responsibleUserId ?? null,
    suppliesAvailableNotifiedAt: job.suppliesAvailableNotifiedAt
      ? new Date(job.suppliesAvailableNotifiedAt)
      : null,
    supplyReplacements: job.supplyReplacements?.length
      ? JSON.stringify(job.supplyReplacements)
      : null,
    printerId: job.printerId ?? null,
    queuePosition: job.queuePosition ?? null,
    notes: job.notes ?? null,
    actualHours: job.actualHours ?? null,
    priorityOverride: job.priorityOverride ?? null,
    responsibleManual: job.responsibleManual ?? false,
    failures: job.failures?.length ? JSON.stringify(job.failures) : null,
    reprintOfJobId: job.reprintOfJobId ?? null,
    consumedAt: job.consumedAt ? new Date(job.consumedAt) : null,
    consumedSpools: job.consumedSpools?.length
      ? toInputJson(job.consumedSpools)
      : Prisma.DbNull,
  };
}
