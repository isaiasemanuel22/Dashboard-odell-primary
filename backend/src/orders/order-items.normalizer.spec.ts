import { ServiceType } from '../common/enums';
import { normalizeIncomingOrderItems } from './order-items.normalizer';

const deps = {
  resolveOrderUnitPrice: (
    _serviceType: ServiceType,
    _productId: string | undefined,
    clientUnitPrice: number,
  ) => clientUnitPrice,
  findProductById: () => null,
};

describe('normalizeIncomingOrderItems insumos y terceros', () => {
  it('línea suelta de insumo: costo igual al precio y ganancia 0', () => {
    const [item] = normalizeIncomingOrderItems(
      [
        {
          serviceType: ServiceType.INSUMO,
          productName: 'Polímero',
          quantity: 2,
          unitPrice: 800,
          unitCost: 100,
          estampadoSupplies: [
            { id: 'l1', supplyId: 'sup-polimero', quantity: 2 },
          ],
        },
      ],
      deps,
    );

    expect(item.unitPrice).toBe(800);
    expect(item.unitCost).toBe(800);
    expect((item.unitPrice ?? 0) - (item.unitCost ?? 0)).toBe(0);
    expect(item.productId).toBeUndefined();
  });

  it('servicio de un tercero: no registra costo', () => {
    const [item] = normalizeIncomingOrderItems(
      [
        {
          serviceType: ServiceType.SERVICIO_TERCERO,
          productName: 'Envío',
          quantity: 1,
          unitPrice: 1500,
          unitCost: 400,
          laborNote: ' moto ',
        },
      ],
      deps,
    );

    expect(item.unitPrice).toBe(1500);
    expect(item.unitCost).toBe(0);
    expect(item.laborNote).toBe('moto');
    expect(item.productId).toBeUndefined();
  });
});
