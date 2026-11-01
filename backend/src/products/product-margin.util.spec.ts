import {
  priceForTargetMarkup,
  productMarkupPercent,
  roundPrice,
} from './product-margin.util';

describe('product-margin.util', () => {
  describe('productMarkupPercent', () => {
    it('calcula markup sobre el costo', () => {
      expect(productMarkupPercent(1400, 1000)).toBeCloseTo(40);
      expect(productMarkupPercent(500, 1000)).toBeCloseTo(-50);
    });

    it('devuelve null si el costo es <= 0', () => {
      expect(productMarkupPercent(1000, 0)).toBeNull();
      expect(productMarkupPercent(1000, -10)).toBeNull();
    });
  });

  describe('roundPrice', () => {
    it('no redondea con roundTo 0', () => {
      expect(roundPrice(1234.56, 0)).toBe(1234.56);
    });

    it('redondea hacia arriba a 100 o 500', () => {
      expect(roundPrice(1001, 100)).toBe(1100);
      expect(roundPrice(1000, 100)).toBe(1000);
      expect(roundPrice(1001, 500)).toBe(1500);
      expect(roundPrice(1500, 500)).toBe(1500);
    });
  });

  describe('priceForTargetMarkup', () => {
    it('aplica markup y redondea a 100 por defecto', () => {
      expect(priceForTargetMarkup(1000, 40)).toBe(1400);
      expect(priceForTargetMarkup(1000, 41)).toBe(1500);
    });

    it('respeta roundTo custom', () => {
      expect(priceForTargetMarkup(1000, 40, 500)).toBe(1500);
      expect(priceForTargetMarkup(1000, 40, 0)).toBe(1400);
    });
  });
});
