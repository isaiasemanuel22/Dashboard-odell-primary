import { ProductFormPricingCalculationService } from './product-form-pricing-calculation.service';

describe('ProductFormPricingCalculationService', () => {
  const service = new ProductFormPricingCalculationService();

  it('aplica el margen solo al proceso y suma los insumos sin margen', () => {
    // costo total 5.467 = proceso 1.967 + insumos 3.500, margen 100%
    const result = service.calculate({
      totalCost: 5467,
      profitMarginPercent: 100,
      supplyValue: 3500,
    });

    expect(result.price).toBe(1967 * 2 + 3500);
    expect(result.profit).toBe(result.price - 5467);
  });

  it('sin insumos aplica el margen al costo total', () => {
    expect(
      service.calculate({ totalCost: 1000, profitMarginPercent: 100 }).price,
    ).toBe(2000);
  });

  it('ignora la suma de piezas y usa costo x margen', () => {
    const result = service.calculate({
      totalCost: 14488,
      profitMarginPercent: 200,
      componentsPrice: 41601,
    });
    expect(result.price).toBe(43464);
  });

  it('el precio sugerido tiene prioridad sobre costo x margen', () => {
    const result = service.calculate({
      totalCost: 14488,
      profitMarginPercent: 200,
      suggestedPrice: 50000,
      componentsPrice: 41601,
    });
    expect(result.price).toBe(50000);
  });

  it('la mano de obra no lleva margen: con margen 100 % suma $1.000, no $2.000', () => {
    expect(
      service.calculate({
        totalCost: 3000,
        profitMarginPercent: 100,
        laborCost: 1000,
      }).price,
    ).toBe(5000);
    expect(
      service.calculate({ totalCost: 2000, profitMarginPercent: 100 }).price,
    ).toBe(4000);
  });
});
