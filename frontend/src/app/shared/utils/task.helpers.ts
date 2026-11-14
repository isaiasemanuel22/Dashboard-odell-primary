import { PrintJob, ServiceType, TaskKind } from '../../core/models';
import { TASK_KIND_LABELS } from '../constants/labels';

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

/** Etiqueta del tipo de tarea: diseño y modelado se muestran por su área, no como «Servicio». */
export function taskKindLabel(job: Pick<PrintJob, 'taskKind' | 'type'>): string {
  if (job.taskKind === TaskKind.SERVICE) {
    if (job.type === ServiceType.DISENO_GRAFICO) return 'Diseño';
    if (job.type === ServiceType.MODELADO) return 'Modelado';
  }
  return TASK_KIND_LABELS[job.taskKind] ?? '';
}
