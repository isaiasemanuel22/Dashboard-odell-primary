import { TestBed } from '@angular/core/testing';
import { GeneralSettings, ProductType } from '../models';
import { SettingsFacade } from '../../store/settings/settings.facade';
import { ProductCostCalculationService } from './product-cost-calculation.service';
import { ProductPricingService } from './product-pricing.service';

describe('ProductPricingService.priceWithSupplies', () => {
  const settings = {
    profitMargins: { impresion_3d: 100, estampado: 100 },
  } as unknown as GeneralSettings;
  let service: ProductPricingService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: SettingsFacade, useValue: {} },
        { provide: ProductCostCalculationService, useValue: {} },
      ],
    });
    service = TestBed.inject(ProductPricingService);
  });

  it('aplica el margen solo al costo de proceso y suma los insumos sin margen', () => {
    // Taza estampada: proceso $1.967 + insumos $3.500, margen 100%.
    const result = service.priceWithSupplies(
      { type: ProductType.ESTAMPADO },
      1967,
      3500,
      [],
      settings,
    );

    expect(result.cost).toBe(5467);
    expect(result.price).toBe(1967 * 2 + 3500);
    expect(result.profit).toBe(result.price - 5467);
  });

  it('sin insumos coincide con aplicar el margen al costo', () => {
    const plain = service.applyMarginToCost(
      { type: ProductType.ESTAMPADO },
      1967,
      [],
      settings,
    );
    const result = service.priceWithSupplies(
      { type: ProductType.ESTAMPADO },
      1967,
      0,
      [],
      settings,
    );

    expect(result.price).toBe(plain.price);
    expect(result.cost).toBe(1967);
  });
});
