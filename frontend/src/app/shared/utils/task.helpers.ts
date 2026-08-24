import { PrintJob, TaskKind } from '../../core/models';

const TASK_KIND_VALUES = new Set<string>(Object.values(TaskKind));

function resolveTaskKind(raw: string | undefined): TaskKind {
  if (!raw) {
    return TaskKind.SERVICE;
  }

  if (TASK_KIND_VALUES.has(raw)) {
    return raw as TaskKind;
  }

  switch (raw.toUpperCase()) {
    case 'PREPARE_ORDER':
      return TaskKind.PREPARE_ORDER;
    case 'PRODUCTION':
      return TaskKind.PRODUCTION;
    case 'INTERNAL':
      return TaskKind.INTERNAL;
    default:
      return TaskKind.SERVICE;
  }
}

export function normalizePrintJob(
  job: PrintJob & { taskType?: string },
): PrintJob {
  return {
    ...job,
    taskKind: resolveTaskKind(job.taskKind ?? job.taskType),
  };
}

export function normalizePrintJobs(
  jobs: Array<PrintJob & { taskType?: string }>,
): PrintJob[] {
  return jobs.map((job) => normalizePrintJob(job));
}
