import { ProductType, SupplyCategory } from '../common/enums';
import type { Product } from '../common/interfaces';
import { packagingPriceFromValue } from '../products/supply-line-value.util';
import { StoreService } from '../store/store.service';
import { createEmptyState } from '../store/store.seed';
import { CostCalculatorService } from './cost-calculator.service';

describe('packaging (§27)', () => {
  it('packagingPriceFromValue: valor × 1,25 redondeado, sin margen de error', () => {
    expect(packagingPriceFromValue(800)).toBe(1000);
    expect(packagingPriceFromValue(130)).toBe(163);
    expect(packagingPriceFromValue(0)).toBe(0);
  });

  describe('costo y precio', () => {
    let store: StoreService;
    let service: CostCalculatorService;

    const addProduct = (extra: Partial<Product> & { id: string }): void => {
      const product = {
        name: extra.id,
        type: ProductType.FDM,
        images: [],
        attachments: [],
        updatedAt: '2026-07-01T10:00:00.000Z',
        price: 5000,
        cost: 2000,
        profit: 3000,
        categoryIds: [],
        size: '',
        published: true,
        includesPieces: false,
        components: [],
        assemblyTimeHours: 0,
        ...extra,
      } as unknown as Product;
      store.products.push(product);
      store.indexProduct(product);
    };

    beforeEach(() => {
      store = new StoreService();
      store.applyState(createEmptyState());
      store.generalSettings = {
        ...store.generalSettings,
        errorMarginPercent: 10,
        laborCostPerHour: 500,
      };
      for (const [id, unitPrice] of [
        ['sup-caja', 400],
        ['sup-bolsa', 100],
      ] as const) {
        store.supplies.push({
          id,
          name: id,
          category: SupplyCategory.PACKAGING,
          unit: 'unidad',
          quantity: 50,
          minStock: 0,
          unitPrice,
          priceFromSettings: false,
          updatedAt: '2026-07-01T10:00:00.000Z',
        });
      }
      service = new CostCalculatorService(store);
    });

    it('producto con precio fijo: suma el valor al costo; el precio queda en el fijo (§16.1.1)', () => {
      const base = {
        type: ProductType.FDM,
        grams: 0,
        cost: 2000,
        suggestedPrice: 5000,
      };
      const without = service.calculateProductPricing(base);
      const result = service.calculateProductPricing({
        ...base,
        packagingSupplies: [{ id: 'k1', supplyId: 'sup-caja', quantity: 2 }],
      });
      // 2 × 400 = 800 al costo; el precio fijo no lleva packaging encima.
      expect(result.cost).toBe(without.cost + 800);
      expect(result.price).toBe(5000);
      expect(without.price).toBe(5000);
    });

    it('estampado con precio fijo + insumos + packaging: precio = fijo, costo = todo', () => {
      store.generalSettings.errorMarginPercent = 0;
      const result = service.calculateProductPricing({
        type: ProductType.ESTAMPADO,
        cost: 1000,
        suggestedPrice: 7000,
        estampadoSupplies: [{ id: 's1', supplyId: 'sup-caja', quantity: 1 }],
        packagingSupplies: [{ id: 'k1', supplyId: 'sup-caja', quantity: 2 }],
      });
      expect(result.price).toBe(7000);
      const withoutFixed = service.calculateProductPricing({
        type: ProductType.ESTAMPADO,
        cost: 1000,
        estampadoSupplies: [{ id: 's1', supplyId: 'sup-caja', quantity: 1 }],
        packagingSupplies: [{ id: 'k1', supplyId: 'sup-caja', quantity: 2 }],
      });
      // El costo incluye todo (insumos y packaging), igual con o sin fijo.
      expect(result.cost).toBe(withoutFixed.cost);
      expect(result.cost).toBeGreaterThanOrEqual(800);
    });

    it('combo con precio fijo: precio = fijo', () => {
      const result = service.calculateProductPricing({
        type: ProductType.COMBO,
        cost: 1000,
        suggestedPrice: 7000,
        packagingSupplies: [{ id: 'k1', supplyId: 'sup-caja', quantity: 2 }],
      });
      expect(result.price).toBe(7000);
    });

    it('sin precio fijo sigue sumando packaging × 1,25', () => {
      const base = { type: ProductType.FDM, grams: 0, cost: 2000 };
      const without = service.calculateProductPricing(base);
      const result = service.calculateProductPricing({
        ...base,
        packagingSupplies: [{ id: 'k1', supplyId: 'sup-caja', quantity: 2 }],
      });
      expect(result.price).toBe(without.price + 1000);
    });

    it('producto sin packaging queda igual', () => {
      const result = service.calculateProductPricing({
        type: ProductType.FDM,
        grams: 0,
        cost: 2000,
        suggestedPrice: 5000,
        packagingSupplies: [],
      });
      expect(result.cost).toBe(2000);
      expect(result.price).toBe(5000);
    });

    describe('combo', () => {
      const comboInput = (sumPieces: boolean) => ({
        type: ProductType.COMBO,
        components: [{ productId: 'pieza', quantity: 3 }],
        assemblyTimeHours: 0,
        packagingSupplies: [{ id: 'k1', supplyId: 'sup-caja', quantity: 1 }],
        sumPiecesPackaging: sumPieces,
      });

      beforeEach(() => {
        addProduct({
          id: 'pieza',
          packagingSupplies: [{ id: 'b1', supplyId: 'sup-bolsa', quantity: 1 }],
        });
      });

      it('sin sumPiecesPackaging: solo su propio packaging', () => {
        const plain = service.calculateProductPricing({
          type: ProductType.COMBO,
          components: [{ productId: 'pieza', quantity: 3 }],
          assemblyTimeHours: 0,
        });
        const result = service.calculateProductPricing(comboInput(false));
        expect(result.cost).toBe(plain.cost + 400);
        expect(result.price).toBe(plain.price + 500);
      });

      it('con sumPiecesPackaging: suma el de cada pieza × cantidad', () => {
        const off = service.calculateProductPricing(comboInput(false));
        const on = service.calculateProductPricing(comboInput(true));
        // 1 bolsa × 100 × 3 piezas = 300 de costo; precio (400 + 300) × 1,25 = 875.
        expect(on.cost).toBe(off.cost + 300);
        expect(on.price).toBe(off.price - 500 + 875);
      });

      it('una pieza usada en un combo no arrastra su packaging si el tilde está apagado', () => {
        const piece = service.calculateProductPricing({
          type: ProductType.COMBO,
          components: [{ productId: 'pieza', quantity: 1 }],
          assemblyTimeHours: 0,
        });
        // El precio guardado de la pieza (5000) trae su packaging (100 × 1,25 = 125): se descuenta.
        expect(piece.price).toBe(4875);
        expect(piece.cost).toBe(2000);
      });
    });
  });
});
