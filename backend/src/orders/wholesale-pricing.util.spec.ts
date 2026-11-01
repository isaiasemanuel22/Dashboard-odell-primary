import { PriceType, ServiceType } from '../common/enums';
import { OrderItem, WholesaleDiscountSettings } from '../common/interfaces';
import { applyWholesalePricing } from './wholesale-pricing.util';

const settings: WholesaleDiscountSettings = {
  enabled: true,
  percent: 20,
  serviceTypes: [ServiceType.IMPRESION_3D, ServiceType.ESTAMPADO],
};

function line(
  partial: Partial<OrderItem> &
    Pick<OrderItem, 'serviceType' | 'productName' | 'quantity' | 'unitPrice'>,
): OrderItem {
  return { ...partial };
}

describe('applyWholesalePricing', () => {
  it('aplica mayorista a áreas configuradas', () => {
    const result = applyWholesalePricing(
      [
        line({
          serviceType: ServiceType.IMPRESION_3D,
          productName: 'Pieza',
          quantity: 2,
          unitPrice: 1000,
        }),
      ],
      {
        priceType: PriceType.MAYORISTA,
        customer: { wholesaleMinimum: undefined },
        settings,
      },
    );

    expect(result.wholesaleApplied).toBe(true);
    expect(result.items[0].listUnitPrice).toBe(1000);
    expect(result.items[0].unitPrice).toBe(800);
  });

  it('no aplica si el subtotal de lista no alcanza el mínimo', () => {
    const result = applyWholesalePricing(
      [
        line({
          serviceType: ServiceType.IMPRESION_3D,
          productName: 'Pieza',
          quantity: 1,
          unitPrice: 1000,
        }),
      ],
      {
        priceType: PriceType.MAYORISTA,
        customer: { wholesaleMinimum: 5000 },
        settings,
      },
    );

    expect(result.wholesaleApplied).toBe(false);
    expect(result.items[0].listUnitPrice).toBeUndefined();
    expect(result.items[0].unitPrice).toBe(1000);
  });

  it('no aplica si el descuento está inactivo', () => {
    const result = applyWholesalePricing(
      [
        line({
          serviceType: ServiceType.IMPRESION_3D,
          productName: 'Pieza',
          quantity: 1,
          unitPrice: 1000,
        }),
      ],
      {
        priceType: PriceType.MAYORISTA,
        customer: null,
        settings: { ...settings, enabled: false },
      },
    );

    expect(result.wholesaleApplied).toBe(false);
    expect(result.items[0].unitPrice).toBe(1000);
    expect(result.items[0].listUnitPrice).toBeUndefined();
  });

  it('deja diseño sin descuento aunque el pedido sea mayorista', () => {
    const result = applyWholesalePricing(
      [
        line({
          serviceType: ServiceType.DISENO_GRAFICO,
          productName: 'Logo',
          quantity: 1,
          unitPrice: 5000,
        }),
        line({
          serviceType: ServiceType.IMPRESION_3D,
          productName: 'Pieza',
          quantity: 1,
          unitPrice: 1000,
        }),
      ],
      {
        priceType: PriceType.MAYORISTA,
        customer: null,
        settings,
      },
    );

    expect(result.wholesaleApplied).toBe(true);
    expect(result.items[0].unitPrice).toBe(5000);
    expect(result.items[0].listUnitPrice).toBeUndefined();
    expect(result.items[1].unitPrice).toBe(800);
    expect(result.items[1].listUnitPrice).toBe(1000);
  });

  it('es idempotente al reaplicar sobre líneas ya rebajadas', () => {
    const first = applyWholesalePricing(
      [
        line({
          serviceType: ServiceType.IMPRESION_3D,
          productName: 'Pieza',
          quantity: 1,
          unitPrice: 1000,
        }),
      ],
      { priceType: PriceType.MAYORISTA, customer: null, settings },
    );

    const second = applyWholesalePricing(first.items, {
      priceType: PriceType.MAYORISTA,
      customer: null,
      settings,
    });

    expect(second.wholesaleApplied).toBe(true);
    expect(second.items[0].listUnitPrice).toBe(1000);
    expect(second.items[0].unitPrice).toBe(800);
  });

  it('aplica sin mínimo cuando el cliente no tiene compra mínima', () => {
    const result = applyWholesalePricing(
      [
        line({
          serviceType: ServiceType.ESTAMPADO,
          productName: 'Remera',
          quantity: 1,
          unitPrice: 100,
        }),
      ],
      {
        priceType: PriceType.MAYORISTA,
        customer: { wholesaleMinimum: undefined },
        settings,
      },
    );

    expect(result.wholesaleApplied).toBe(true);
    expect(result.items[0].unitPrice).toBe(80);
  });

  it('con priceType lista cobra siempre precio de lista', () => {
    const result = applyWholesalePricing(
      [
        line({
          serviceType: ServiceType.IMPRESION_3D,
          productName: 'Pieza',
          quantity: 1,
          unitPrice: 800,
          listUnitPrice: 1000,
        }),
      ],
      { priceType: PriceType.LISTA, customer: null, settings },
    );

    expect(result.wholesaleApplied).toBe(false);
    expect(result.items[0].unitPrice).toBe(1000);
    expect(result.items[0].listUnitPrice).toBeUndefined();
  });
});
