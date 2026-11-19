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
  const unitPrices: Record<string, number> = { caja: 400, bolsa: 100 };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: SettingsFacade, useValue: {} },
        {
          provide: ProductCostCalculationService,
          useValue: { supplyUnitPrice: (id: string) => unitPrices[id] ?? 0 },
        },
      ],
    });
    service = TestBed.inject(ProductPricingService);
  });

  it('aplica el margen solo al costo de proceso y suma los insumos a costo × 2 sin margen', () => {
    // Taza estampada: proceso $1.967 + insumos $3.500, margen 100%.
    const result = service.priceWithSupplies(
      { type: ProductType.ESTAMPADO },
      1967,
      3500,
      [],
      settings,
    );

    expect(result.cost).toBe(5467);
    // Insumos 3.500 → 7.000 en el precio; el costo no cambia.
    expect(result.price).toBe(1967 * 2 + 7000);
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
  describe('packaging (§27)', () => {
    it('suma el valor al costo y valor × 1,25 al precio, sin margen de error', () => {
      const result = service.priceWithSupplies(
        { type: ProductType.ESTAMPADO },
        1000,
        0,
        [],
        { ...settings, errorMarginPercent: 10 } as GeneralSettings,
        0,
        800,
      );
      expect(result.cost).toBe(1800);
      expect(result.price).toBe(1000 * 2 + 1000);
    });

    it('con insumos y packaging suma los dos aparte del margen', () => {
      const result = service.priceWithSupplies(
        { type: ProductType.ESTAMPADO },
        1000,
        500,
        [],
        settings,
        0,
        800,
      );
      expect(result.cost).toBe(1000 + 500 + 800);
      expect(result.price).toBe(2000 + 1000 + 1000);
    });

    describe('combo con o sin «Sumar el packaging de las piezas»', () => {
      const piece = (id: string, packaging: number): Product =>
        ({
          id,
          name: id,
          type: ProductType.FDM,
          price: 5000,
          cost: 2000,
          components: [],
          packagingSupplies: [{ id: 'x', supplyId: 'caja', quantity: packaging }],
        }) as unknown as Product;
      const catalog = [piece('p-a', 1), piece('p-b', 2)];
      const components = [
        { productId: 'p-a', quantity: 2 },
        { productId: 'p-b', quantity: 1 },
      ];
      const own = [{ id: 'o', supplyId: 'bolsa', quantity: 3 }];

      it('apagado: solo el packaging propio del combo', () => {
        expect(
          service.packagingValue(
            {
              type: ProductType.COMBO,
              components,
              packagingSupplies: own,
              sumPiecesPackaging: false,
            },
            catalog,
          ),
        ).toBe(300);
      });

      it('prendido: suma el de cada pieza × cantidad (2×400 + 2×400 + 300)', () => {
        const value = service.packagingValue(
          {
            type: ProductType.COMBO,
            components,
            packagingSupplies: own,
            sumPiecesPackaging: true,
          },
          catalog,
        );
        expect(value).toBe(300 + 2 * 400 + 2 * 400);
        const result = service.priceWithSupplies(
          { type: ProductType.COMBO, components },
          0,
          0,
          catalog,
          settings,
          0,
          value,
        );
        expect(result.cost).toBe(value);
        // Piezas sin su packaging: (5.000 − 500) × 2 + (5.000 − 1.000) = 13.000.
        expect(result.price).toBe(13000 + Math.round(value * 1.25));
      });

      it('una pieza combo aporta solo su packaging propio, sin recursión', () => {
        const nested = {
          id: 'c1',
          name: 'c1',
          type: ProductType.COMBO,
          price: 9000,
          cost: 4000,
          components: [{ productId: 'p-a', quantity: 1 }],
          includesPieces: true,
          sumPiecesPackaging: true,
          packagingSupplies: own,
        } as unknown as Product;
        expect(
          service.packagingValue(
            {
              type: ProductType.COMBO,
              components: [{ productId: 'c1', quantity: 1 }],
              packagingSupplies: [],
              sumPiecesPackaging: true,
            },
            [...catalog, nested],
          ),
        ).toBe(300);
      });
    });
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

    it('suma el armado sin margen y los insumos a costo × 2', () => {
      const result = service.priceWithSupplies(
        { type: ProductType.COMBO, components },
        3000,
        1000,
        catalog,
        settings,
        1000,
      );
      expect(result.price).toBe(10000 + 1000 + 2000);
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
