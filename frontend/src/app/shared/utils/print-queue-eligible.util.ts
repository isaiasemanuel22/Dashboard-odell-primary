import { PrintJob, ServiceType, TaskKind } from '../../core/models';

/**
 * Aproxima elegibilidad de cola por impresora (área impresión 3D +
 * producción/interna con producto). El backend valida FDM y estado.
 */
export function isEligibleForPrinterQueue(job: PrintJob): boolean {
  if (job.type !== ServiceType.IMPRESION_3D) return false;
  if (
    job.taskKind !== TaskKind.PRODUCTION &&
    job.taskKind !== TaskKind.INTERNAL
  ) {
    return false;
  }
  if (job.taskKind === TaskKind.INTERNAL && !job.productId) return false;
  return true;
}
