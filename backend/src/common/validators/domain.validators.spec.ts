import { BadRequestException } from '@nestjs/common';
import { OrderStatus, PrintJobStatus, ServiceType } from '../enums';
import {
  assertOrderStatusTransition,
  assertPrintJobStatusTransition,
  assertValidEmail,
} from './domain.validators';

describe('domain.validators', () => {
  it('valida emails correctamente', () => {
    expect(() => assertValidEmail('cliente@ejemplo.com')).not.toThrow();
    expect(() => assertValidEmail('invalido')).toThrow(BadRequestException);
  });

  it('permite transiciones válidas de pedidos', () => {
    expect(() =>
      assertOrderStatusTransition(
        OrderStatus.PENDIENTE,
        OrderStatus.EN_PRODUCCION,
      ),
    ).not.toThrow();
  });

  it('rechaza transiciones inválidas de pedidos', () => {
    expect(() =>
      assertOrderStatusTransition(OrderStatus.ENTREGADO, OrderStatus.PENDIENTE),
    ).toThrow(BadRequestException);
  });

  it('rechicha cambios desde tareas terminadas', () => {
    expect(() =>
      assertPrintJobStatusTransition(
        PrintJobStatus.TERMINADO,
        PrintJobStatus.EN_PROCESO,
      ),
    ).toThrow(BadRequestException);
  });
});

describe('OrderStatus enum', () => {
  it('contiene los estados esperados', () => {
    expect(Object.values(OrderStatus)).toContain(OrderStatus.PENDIENTE);
    expect(Object.values(ServiceType)).toContain(ServiceType.IMPRESION_3D);
    expect(Object.values(PrintJobStatus)).toContain(PrintJobStatus.POR_HACER);
  });
});
