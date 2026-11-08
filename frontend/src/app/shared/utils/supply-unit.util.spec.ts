import {
  computeSupplyPurchaseDelta,
  formatSupplyQuantity,
} from './supply-unit.util';

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

describe('formatSupplyQuantity', () => {
  it('pasa kg < 1 a gramos', () => {
    expect(formatSupplyQuantity(0.02, 'kg')).toBe('20 g');
    expect(formatSupplyQuantity(0.08, 'kg')).toBe('80 g');
  });

  it('muestra kg >= 1 con hasta 2 decimales', () => {
    expect(formatSupplyQuantity(1.25, 'kg')).toBe('1,25 kg');
    expect(formatSupplyQuantity(2, 'kg')).toBe('2 kg');
  });

  it('pasa L < 1 a ml', () => {
    expect(formatSupplyQuantity(0.05, 'L')).toBe('50 ml');
  });

  it('mantiene g/ml sin convertir', () => {
    expect(formatSupplyQuantity(20, 'g')).toBe('20 g');
    expect(formatSupplyQuantity(15.5, 'ml')).toBe('15,5 ml');
  });
});
