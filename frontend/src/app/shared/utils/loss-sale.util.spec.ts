import { ServiceType } from '../../core/models';
import { detectLossSale, LossSaleItemInput } from './loss-sale.util';
import { lossReasonNotice } from './loss-reason';

const line = (over: Partial<LossSaleItemInput>): LossSaleItemInput => ({
  serviceType: ServiceType.IMPRESION_3D,
  productName: 'Pieza',
  quantity: 1,
  unitPrice: 100,
  unitCost: 50,
  ...over,
});

describe('detectLossSale', () => {
  it('no hay pérdida con ganancia positiva', () => {
    const r = detectLossSale([line({})], 100);
    expect(r.isLoss).toBe(false);
    expect(r.profit).toBe(50);
  });

  it('detecta línea con precio menor al costo', () => {
    const r = detectLossSale(
      [line({}), line({ unitPrice: 40, quantity: 2, unitCost: 60 })],
      180,
    );
    expect(r.lines).toEqual([
      { index: 1, productName: 'Pieza', unitPrice: 40, unitCost: 60, loss: 40 },
    ]);
    expect(r.isLoss).toBe(true);
  });

  it('detecta ganancia total negativa por descuento', () => {
    const r = detectLossSale([line({})], 40);
    expect(r.lines.length).toBe(0);
    expect(r.profitNegative).toBe(true);
  });

  it('insumo suelto con precio igual al costo no es pérdida', () => {
    const r = detectLossSale(
      [line({ serviceType: ServiceType.INSUMO, unitPrice: 30, unitCost: 30 })],
      30,
    );
    expect(r.isLoss).toBe(false);
  });

  it('servicio de tercero cobrado menos que su costo es pérdida (§16.3)', () => {
    const r = detectLossSale(
      [line({ serviceType: ServiceType.SERVICIO_TERCERO, unitPrice: 200, unitCost: 500 })],
      200,
    );
    expect(r.isLoss).toBe(true);
    expect(r.lines[0].loss).toBe(300);
    expect(r.profit).toBe(-300);
  });

  it('diseño compara precio de diseño con costo de diseño', () => {
    const r = detectLossSale(
      [
        line({
          serviceType: ServiceType.DISENO_GRAFICO,
          unitPrice: 800,
          designUnitPrice: 800,
          unitCost: 1000,
        }),
      ],
      800,
    );
    expect(r.lines[0]).toEqual(
      jasmine.objectContaining({ unitPrice: 800, unitCost: 1000, loss: 200 }),
    );
  });
});

describe('detectLossSale con servicio de tercero y descuento', () => {
  it('la ganancia descuenta el costo del tercero como cualquier línea', () => {
    const items = [
      line({ unitPrice: 1000, unitCost: 600, quantity: 2 }),
      line({ serviceType: ServiceType.SERVICIO_TERCERO, unitPrice: 500, unitCost: 500 }),
    ];
    // Subtotal 2.500, descuento 60 % => total 1.000; costo 1.200 + 500.
    const r = detectLossSale(items, 1000);
    expect(r.profit).toBe(1000 - 1200 - 500);
    expect(r.profitNegative).toBeTrue();
  });
});

describe('lossReasonNotice', () => {
  it('arma el aviso con motivo y nota', () => {
    expect(lossReasonNotice('muestra', 'cliente nuevo')).toBe(
      'Vendido a pérdida · Muestra o prueba para un cliente nuevo · cliente nuevo',
    );
    expect(lossReasonNotice(undefined)).toBe('');
  });
});
