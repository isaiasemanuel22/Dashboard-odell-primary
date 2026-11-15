import { TestBed } from '@angular/core/testing';
import { GeneralSettings, Product, ProductType } from '../models';
import { productSalePrice } from '../../shared/utils/product-discount.util';
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

  it('aplica el margen solo al costo de proceso y suma los insumos a costo × 1,5 sin margen', () => {
    // Taza estampada: proceso $1.967 + insumos $3.500, margen 100%.
    const result = service.priceWithSupplies(
      { type: ProductType.ESTAMPADO },
      1967,
      3500,
      [],
      settings,
    );

    expect(result.cost).toBe(5467);
    // Insumos 3.500 → 5.250 en el precio; el costo no cambia.
    expect(result.price).toBe(1967 * 2 + 5250);
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
  describe('combo: lista = suma de precios de lista de las piezas', () => {
    const piece = (id: string, price: number): Product =>
      ({
        id,
        name: id,
        type: ProductType.FDM,
        price,
        cost: 1000,
        profit: price - 1000,
        components: [],
        includesPieces: false,
        // El descuento de una pieza no entra en la suma del combo.
        discountPercent: 50,
      }) as unknown as Product;
    const catalog = [piece('p-a', 6000), piece('p-b', 4000)];
    const components = [
      { productId: 'p-a', quantity: 1 },
      { productId: 'p-b', quantity: 1 },
    ];

    it('piezas $6.000 y $4.000 sin armado ni insumos dan lista $10.000 y venta $8.500 con 15 %', () => {
      const result = service.priceWithSupplies(
        { type: ProductType.COMBO, components },
        2000,
        0,
        catalog,
        settings,
      );
      expect(result.price).toBe(10000);
      expect(result.cost).toBe(2000);
      expect(productSalePrice({ price: result.price, discountPercent: 15 })).toBe(8500);
    });

    it('suma el armado sin margen y los insumos a costo × 1,5', () => {
      const result = service.priceWithSupplies(
        { type: ProductType.COMBO, components },
        3000,
        1000,
        catalog,
        settings,
        1000,
      );
      expect(result.price).toBe(10000 + 1000 + 1500);
      expect(result.cost).toBe(4000);
    });

    it('con precio fijo manda el fijo como lista', () => {
      const result = service.priceWithSupplies(
        { type: ProductType.COMBO, components, suggestedPrice: 7000 },
        2000,
        0,
        catalog,
        settings,
      );
      expect(result.price).toBe(7000);
    });
  });
});
