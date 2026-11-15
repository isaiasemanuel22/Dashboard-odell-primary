import { BadRequestException } from '@nestjs/common';
import { ServiceType } from '../enums';
import {
  detectLossSale,
  LossSaleItemInput,
  resolveLossReason,
} from './loss-sale.util';

type Item = LossSaleItemInput & { unitCost?: number };
const cost = (item: LossSaleItemInput) => (item as Item).unitCost ?? 0;
const line = (over: Partial<Item>): Item => ({
  serviceType: ServiceType.IMPRESION_3D,
  productName: 'Pieza',
  quantity: 1,
  unitPrice: 100,
  unitCost: 50,
  ...over,
});

describe('detectLossSale', () => {
  it('no hay pérdida con ganancia positiva', () => {
    const r = detectLossSale([line({})], 100, cost);
    expect(r.isLoss).toBe(false);
    expect(r.profit).toBe(50);
  });

  it('detecta línea con precio menor al costo', () => {
    const items = [
      line({}),
      line({ unitPrice: 40, quantity: 2, unitCost: 60 }),
    ];
    const r = detectLossSale(items, 180, cost);
    expect(r.lines).toEqual([
      { index: 1, productName: 'Pieza', unitPrice: 40, unitCost: 60, loss: 40 },
    ]);
    expect(r.isLoss).toBe(true);
    expect(r.profitNegative).toBe(false);
  });

  it('detecta ganancia total negativa por descuento', () => {
    const r = detectLossSale([line({})], 40, cost);
    expect(r.lines).toHaveLength(0);
    expect(r.profitNegative).toBe(true);
    expect(r.isLoss).toBe(true);
  });

  it('insumo suelto con precio igual al costo no es pérdida', () => {
    const r = detectLossSale(
      [line({ serviceType: ServiceType.INSUMO, unitPrice: 30, unitCost: 30 })],
      30,
      cost,
    );
    expect(r.isLoss).toBe(false);
  });

  it('servicio de tercero cuenta su costo como cualquier línea (§16.3)', () => {
    const r = detectLossSale(
      [
        line({
          serviceType: ServiceType.SERVICIO_TERCERO,
          unitPrice: 200,
          unitCost: 500,
        }),
      ],
      200,
      cost,
    );
    expect(r.isLoss).toBe(true);
    expect(r.profit).toBe(-300);
    expect(r.lines[0].loss).toBe(300);
  });

  it('servicio de tercero cobrado al costo no es pérdida', () => {
    const r = detectLossSale(
      [
        line({
          serviceType: ServiceType.SERVICIO_TERCERO,
          unitPrice: 500,
          unitCost: 500,
        }),
      ],
      500,
      cost,
    );
    expect(r.isLoss).toBe(false);
    expect(r.profit).toBe(0);
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
      cost,
    );
    expect(r.lines[0]).toMatchObject({
      unitPrice: 800,
      unitCost: 1000,
      loss: 200,
    });
  });
});

describe('resolveLossReason', () => {
  const loss = detectLossSale([line({ unitPrice: 10 })], 10, cost);
  const ok = detectLossSale([line({})], 100, cost);

  it('rechaza sin motivo', () => {
    expect(() => resolveLossReason(loss, {})).toThrow(BadRequestException);
  });

  it('rechaza motivo desconocido y "otro" sin nota', () => {
    expect(() => resolveLossReason(loss, { lossReason: 'xx' })).toThrow(
      BadRequestException,
    );
    expect(() => resolveLossReason(loss, { lossReason: 'otro' })).toThrow(
      BadRequestException,
    );
  });

  it('acepta con motivo y recorta la nota', () => {
    expect(
      resolveLossReason(loss, {
        lossReason: 'muestra',
        lossReasonNote: ' hola ',
      }),
    ).toEqual({ lossReason: 'muestra', lossReasonNote: 'hola' });
  });

  it('limpia el motivo si ya no hay pérdida', () => {
    expect(resolveLossReason(ok, { lossReason: 'muestra' })).toEqual({});
  });

  it('allowMissing no bloquea', () => {
    expect(resolveLossReason(loss, {}, { allowMissing: true })).toEqual({});
  });
});
