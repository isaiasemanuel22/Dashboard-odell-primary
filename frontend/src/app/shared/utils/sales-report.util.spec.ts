import { ProductType, SaleSource, ServiceType } from '../../core/models';
import { buildSalesReportAreaSections } from './sales-report.util';

describe('sales-report.util', () => {
  it('agrupa ventas por área y producto', () => {
    const sections = buildSalesReportAreaSections(
      [
        {
          id: 'retail-1',
          source: SaleSource.RETAIL,
          saleId: 'v-1',
          items: [
            {
              productId: 'p1',
              productName: 'Taza mágica',
              quantity: 2,
              unitPrice: 1000,
              lineTotal: 2000,
            },
            {
              productId: 'p2',
              productName: 'Taza de cerámica',
              quantity: 1,
              unitPrice: 1500,
              lineTotal: 1500,
            },
          ],
          total: 3500,
          cost: 1400,
          profit: 2100,
          soldAt: '2026-08-10T12:00:00.000Z',
          editable: true,
        },
      ],
      (productId) =>
        productId === 'p1' || productId === 'p2'
          ? { type: ProductType.ESTAMPADO }
          : null,
    );

    expect(sections.length).toBe(1);
    expect(sections[0]?.area).toBe(ServiceType.ESTAMPADO);
    expect(sections[0]?.rows).toEqual([
      jasmine.objectContaining({
        productName: 'Taza de cerámica',
        quantity: 1,
      }),
      jasmine.objectContaining({
        productName: 'Taza mágica',
        quantity: 2,
      }),
    ]);
  });

  it('B7: agrupa por id de producto, no por nombre', () => {
    const item = (productId: string, productName: string, quantity: number) => ({
      productId,
      productName,
      quantity,
      unitPrice: 1000,
      lineTotal: 1000 * quantity,
    });
    const sections = buildSalesReportAreaSections(
      [
        {
          id: 'retail-1',
          source: SaleSource.RETAIL,
          saleId: 'v-1',
          items: [
            item('p1', 'Taza', 1),
            item('p2', 'Taza', 2),
            item('p1', 'Taza (renombrada)', 3),
          ],
          total: 6000,
          cost: 0,
          profit: 6000,
          soldAt: '2026-08-10T12:00:00.000Z',
          editable: true,
        },
      ],
      () => ({ type: ProductType.ESTAMPADO }),
    );
    const rows = sections[0]?.rows ?? [];
    expect(rows.length).toBe(2);
    expect(rows.map((row) => row.quantity).sort()).toEqual([2, 4]);
  });
});
