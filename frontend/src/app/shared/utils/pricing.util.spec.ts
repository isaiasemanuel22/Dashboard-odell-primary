import { priceFromCostAndMargin } from './pricing.util';

describe('priceFromCostAndMargin', () => {
  it('margen 100 % sobre costo sin mano de obra, mano de obra $1.000 sin margen', () => {
    expect(priceFromCostAndMargin(3000, 100, 1000)).toBe(5000);
  });

  it('sin mano de obra aplica el margen al costo total', () => {
    expect(priceFromCostAndMargin(3000, 100)).toBe(6000);
  });

  it('ignora mano de obra mayor al costo', () => {
    expect(priceFromCostAndMargin(1000, 100, 5000)).toBe(1000);
  });
});
