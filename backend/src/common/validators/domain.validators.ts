import { BadRequestException } from '@nestjs/common';
import { PrintJobStatus } from '../enums';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function assertValidEmail(email: string, field = 'email'): void {
  if (!EMAIL_PATTERN.test(email)) {
    throw new BadRequestException(`${field} inválido`);
  }
}

export function assertNonNegativeNumber(
  value: number,
  field: string,
  options?: { allowZero?: boolean },
): void {
  if (!Number.isFinite(value)) {
    throw new BadRequestException(`${field} debe ser un número`);
  }
  if (options?.allowZero === false && value <= 0) {
    throw new BadRequestException(`${field} debe ser mayor que 0`);
  }
  if (value < 0) {
    throw new BadRequestException(`${field} no puede ser negativo`);
  }
}

export function assertPrintJobStatus(status: PrintJobStatus): void {
  if (!Object.values(PrintJobStatus).includes(status)) {
    throw new BadRequestException('Estado de tarea inválido');
  }
}

export function assertPrintJobStatusTransition(
  current: PrintJobStatus,
  next: PrintJobStatus,
): void {
  assertPrintJobStatus(next);
  if (current === next) return;

  if (current === PrintJobStatus.CANCELADO) {
    throw new BadRequestException(
      `No se puede cambiar el estado de una tarea ${current}`,
    );
  }
}
