import { ServiceType } from '../common/enums';
import {
  DEFAULT_WHOLESALE_DISCOUNT,
  appliesWholesale,
  normalizeWholesaleDiscount,
  wholesaleUnitPrice,
} from './wholesale-discount.util';

describe('wholesale-discount.util', () => {
  it('expone el default de Ajustes › Ganancias', () => {
    expect(DEFAULT_WHOLESALE_DISCOUNT).toEqual({
      enabled: true,
      percent: 20,
      serviceTypes: [ServiceType.IMPRESION_3D, ServiceType.ESTAMPADO],
    });
  });

  it('normaliza datos inválidos o vacíos al default', () => {
    expect(normalizeWholesaleDiscount(null)).toEqual(
      DEFAULT_WHOLESALE_DISCOUNT,
    );
    expect(normalizeWholesaleDiscount({})).toEqual(DEFAULT_WHOLESALE_DISCOUNT);
    expect(
      normalizeWholesaleDiscount({
        enabled: 'yes',
        percent: 150,
        serviceTypes: 'no-array',
      }),
    ).toEqual(DEFAULT_WHOLESALE_DISCOUNT);
    expect(
      normalizeWholesaleDiscount({
        enabled: true,
        percent: 10,
        serviceTypes: ['otro', ServiceType.ESTAMPADO, 'otro'],
      }),
    ).toEqual({
      enabled: true,
      percent: 10,
      serviceTypes: [ServiceType.ESTAMPADO],
    });
  });

  it('acepta percent entero o decimal y filtra serviceTypes sin repetidos', () => {
    expect(
      normalizeWholesaleDiscount({
        enabled: false,
        percent: '12.5',
        serviceTypes: [
          ServiceType.IMPRESION_3D,
          'invalido',
          ServiceType.IMPRESION_3D,
          ServiceType.MODELADO,
        ],
      }),
    ).toEqual({
      enabled: false,
      percent: 12.5,
      serviceTypes: [ServiceType.IMPRESION_3D, ServiceType.MODELADO],
    });
  });

  it('no aplica descuento a áreas fuera de la configuración', () => {
    const settings = normalizeWholesaleDiscount({
      enabled: true,
      percent: 20,
      serviceTypes: [ServiceType.IMPRESION_3D, ServiceType.ESTAMPADO],
    });
    expect(appliesWholesale(settings, ServiceType.DISENO_GRAFICO)).toBe(false);
    expect(wholesaleUnitPrice(1000, settings, ServiceType.DISENO_GRAFICO)).toBe(
      1000,
    );
  });

  it('redondea el precio con descuento aplicado', () => {
    const settings = normalizeWholesaleDiscount({
      enabled: true,
      percent: 20,
      serviceTypes: [ServiceType.IMPRESION_3D],
    });
    expect(wholesaleUnitPrice(999, settings, ServiceType.IMPRESION_3D)).toBe(
      799,
    );
  });

  it('devuelve precio de lista si el descuento está inactivo', () => {
    const settings = normalizeWholesaleDiscount({
      enabled: false,
      percent: 20,
      serviceTypes: [ServiceType.IMPRESION_3D],
    });
    expect(appliesWholesale(settings, ServiceType.IMPRESION_3D)).toBe(false);
    expect(wholesaleUnitPrice(1000, settings, ServiceType.IMPRESION_3D)).toBe(
      1000,
    );
  });
});
