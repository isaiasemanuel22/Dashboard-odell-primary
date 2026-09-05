import { computeSupplyPurchaseDelta } from './supply-unit.util';

describe('computeSupplyPurchaseDelta', () => {
  it('devuelve negativo cuando se pagó menos que lista', () => {
    expect(computeSupplyPurchaseDelta(4800, 2, 2500)).toBe(-200);
  });

  it('devuelve cero al precio de lista', () => {
    expect(computeSupplyPurchaseDelta(5000, 2, 2500)).toBe(0);
  });

  it('devuelve positivo cuando se pagó más que lista', () => {
    expect(computeSupplyPurchaseDelta(5200, 2, 2500)).toBe(200);
  });

  it('recalcula si cambia el valor unitario editado', () => {
    expect(computeSupplyPurchaseDelta(4800, 2, 2400)).toBe(0);
  });
});
