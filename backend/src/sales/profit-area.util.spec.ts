import { ProductType, ServiceType } from '../common/enums';
import { resolveProfitArea, computeAreaProfitBalances } from './profit-area.util';
import { SaleEntry, SaleEntryItem } from '../common/interfaces';

describe('profit-area.util', () => {
  describe('resolveProfitArea', () => {
    it('clasifica productos de estampado', () => {
      expect(
        resolveProfitArea({ type: ProductType.ESTAMPADO }, ServiceType.IMPRESION_3D),
      ).toBe(ServiceType.ESTAMPADO);
    });

    it('clasifica productos 3D', () => {
      expect(resolveProfitArea({ type: ProductType.FDM })).toBe(
        ServiceType.IMPRESION_3D,
      );
      expect(resolveProfitArea({ type: ProductType.RESINA })).toBe(
        ServiceType.IMPRESION_3D,
      );
      expect(resolveProfitArea({ type: ProductType.COMBO })).toBe(
        ServiceType.IMPRESION_3D,
      );
    });

    it('usa el servicio cuando no hay producto de catálogo', () => {
      expect(resolveProfitArea(null, ServiceType.ESTAMPADO)).toBe(
        ServiceType.ESTAMPADO,
      );
      expect(resolveProfitArea(undefined, ServiceType.IMPRESION_3D)).toBe(
        ServiceType.IMPRESION_3D,
      );
      expect(resolveProfitArea(null, ServiceType.DISENO_GRAFICO)).toBe(
        ServiceType.DISENO_GRAFICO,
      );
      expect(resolveProfitArea(null, ServiceType.MODELADO)).toBe(
        ServiceType.MODELADO,
      );
    });
  });

  describe('computeAreaProfitBalances', () => {
    it('agrupa ingresos, costos y ganancias por área', () => {
      const entries: SaleEntry[] = [
        {
          id: 'retail-1',
          source: 'retail' as never,
          saleId: 'v-1',
          items: [
            {
              productId: 'prod-3d',
              productName: 'Pieza',
              quantity: 2,
              unitPrice: 1000,
              lineTotal: 2000,
            },
          ],
          total: 2000,
          cost: 800,
          profit: 1200,
          soldAt: new Date().toISOString(),
          editable: true,
        },
        {
          id: 'order-1',
          source: 'order' as never,
          saleId: 'ord-1',
          items: [
            {
              productName: 'Remera estampada',
              quantity: 1,
              unitPrice: 1500,
              lineTotal: 1500,
              serviceType: ServiceType.ESTAMPADO,
            },
          ],
          total: 1500,
          cost: 500,
          profit: 1000,
          soldAt: new Date().toISOString(),
          editable: false,
        },
      ];

      const balances = computeAreaProfitBalances(
        entries,
        (item: SaleEntryItem) => (item.productId === 'prod-3d' ? 400 : 500),
        (productId) =>
          productId === 'prod-3d' ? { type: ProductType.FDM } : null,
      );

      expect(balances).toEqual([
        {
          area: ServiceType.IMPRESION_3D,
          revenue: 2000,
          cost: 800,
          profit: 1200,
          retail: { revenue: 2000, cost: 800, profit: 1200 },
          orders: { revenue: 0, cost: 0, profit: 0 },
        },
        {
          area: ServiceType.DISENO_GRAFICO,
          revenue: 0,
          cost: 0,
          profit: 0,
          retail: { revenue: 0, cost: 0, profit: 0 },
          orders: { revenue: 0, cost: 0, profit: 0 },
        },
        {
          area: ServiceType.MODELADO,
          revenue: 0,
          cost: 0,
          profit: 0,
          retail: { revenue: 0, cost: 0, profit: 0 },
          orders: { revenue: 0, cost: 0, profit: 0 },
        },
        {
          area: ServiceType.ESTAMPADO,
          revenue: 1500,
          cost: 500,
          profit: 1000,
          retail: { revenue: 0, cost: 0, profit: 0 },
          orders: { revenue: 1500, cost: 500, profit: 1000 },
        },
      ]);
    });

    it('reparte descuentos proporcionalmente entre líneas del mismo área', () => {
      const entries: SaleEntry[] = [
        {
          id: 'retail-2',
          source: 'retail' as never,
          saleId: 'v-2',
          items: [
            {
              productId: 'prod-3d',
              productName: 'Pieza A',
              quantity: 1,
              unitPrice: 1000,
              lineTotal: 1000,
            },
            {
              productId: 'prod-3d',
              productName: 'Pieza B',
              quantity: 1,
              unitPrice: 1000,
              lineTotal: 1000,
            },
          ],
          total: 1500,
          cost: 600,
          profit: 900,
          soldAt: new Date().toISOString(),
          editable: true,
        },
      ];

      const balances = computeAreaProfitBalances(
        entries,
        () => 300,
        () => ({ type: ProductType.FDM }),
      );

      expect(balances[0]).toEqual({
        area: ServiceType.IMPRESION_3D,
        revenue: 1500,
        cost: 600,
        profit: 900,
        retail: { revenue: 1500, cost: 600, profit: 900 },
        orders: { revenue: 0, cost: 0, profit: 0 },
      });
    });
  });
});
