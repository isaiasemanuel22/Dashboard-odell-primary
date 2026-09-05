import { ServiceType } from '../common/enums';
import {
  calculateOrderItemsSubtotal,
  calculateOrderLineSubtotal,
} from './order-pricing.util';

describe('order-pricing.util', () => {
  it('cobra el diseño una sola vez sin impresión', () => {
    const total = calculateOrderLineSubtotal({
      serviceType: ServiceType.DISENO_GRAFICO,
      quantity: 10,
      unitPrice: 15000,
      designUnitPrice: 15000,
      includesPrint: false,
    });

    expect(total).toBe(15000);
  });

  it('cobra diseño una vez e impresiones por cantidad', () => {
    const total = calculateOrderLineSubtotal({
      serviceType: ServiceType.DISENO_GRAFICO,
      quantity: 10,
      unitPrice: 151,
      designUnitPrice: 10000,
      includesPrint: true,
    });

    expect(total).toBe(11510);
  });

  it('interpreta pedidos viejos con precio unitario combinado', () => {
    const total = calculateOrderLineSubtotal({
      serviceType: ServiceType.DISENO_GRAFICO,
      quantity: 10,
      unitPrice: 10151,
      designUnitPrice: 10000,
      includesPrint: true,
    });

    expect(total).toBe(11510);
  });

  it('suma líneas de producto por cantidad', () => {
    const total = calculateOrderItemsSubtotal([
      {
        serviceType: ServiceType.IMPRESION_3D,
        quantity: 2,
        unitPrice: 5000,
      },
      {
        serviceType: ServiceType.DISENO_GRAFICO,
        quantity: 5,
        unitPrice: 200,
        designUnitPrice: 8000,
        includesPrint: true,
      },
    ]);

    expect(total).toBe(19000);
  });
});
