import { BadRequestException } from '@nestjs/common';
import { OrderStatus, PrintJobStatus } from '../enums';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TERMINAL_ORDER_STATUSES = new Set<OrderStatus>([
  OrderStatus.ENTREGADO,
  OrderStatus.CANCELADO,
]);

const ALLOWED_ORDER_TRANSITIONS: Partial<
  Record<OrderStatus, readonly OrderStatus[]>
> = {
  [OrderStatus.PENDIENTE]: [
    OrderStatus.EN_PRODUCCION,
    OrderStatus.CANCELADO,
    OrderStatus.COMPLETADO,
  ],
  [OrderStatus.EN_PRODUCCION]: [
    OrderStatus.PENDIENTE,
    OrderStatus.COMPLETADO,
    OrderStatus.CANCELADO,
  ],
  [OrderStatus.COMPLETADO]: [
    OrderStatus.EN_PRODUCCION,
    OrderStatus.ENTREGADO,
    OrderStatus.CANCELADO,
  ],
  [OrderStatus.ENTREGADO]: [],
  [OrderStatus.CANCELADO]: [],
};

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

export function assertOrderStatusTransition(
  current: OrderStatus,
  next: OrderStatus,
): void {
  if (current === next) return;

  if (TERMINAL_ORDER_STATUSES.has(current)) {
    throw new BadRequestException(
      `No se puede cambiar el estado de un pedido ${current}`,
    );
  }

  const allowed = ALLOWED_ORDER_TRANSITIONS[current] ?? [];
  if (!allowed.includes(next)) {
    throw new BadRequestException(
      `Transición de estado inválida: ${current} → ${next}`,
    );
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

  if (
    current === PrintJobStatus.CANCELADO ||
    current === PrintJobStatus.TERMINADO
  ) {
    throw new BadRequestException(
      `No se puede cambiar el estado de una tarea ${current}`,
    );
  }
}
