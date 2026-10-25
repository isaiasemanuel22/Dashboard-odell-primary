import { FilamentType, ProductType, ServiceType } from '../common/enums';
import { unpublishedProductFromQuoteLine } from './quote-product.util';

describe('unpublishedProductFromQuoteLine', () => {
  it('crea un producto no publicado con el nombre y sin marca ni categoría', () => {
    const product = unpublishedProductFromQuoteLine(
      {
        serviceType: ServiceType.IMPRESION_3D,
        productName: 'Mate nuevo',
        quantity: 1,
        unitPrice: 2500,
        grams: 40,
        printTimeHours: 2,
        filamentType: FilamentType.PLA,
      },
      'prod-9',
      '2026-10-21T12:00:00.000Z',
    );

    expect(product).toMatchObject({
      id: 'prod-9',
      name: 'Mate nuevo',
      type: ProductType.FDM,
      published: false,
      categoryIds: [],
      price: 2500,
      cost: 0,
    });
    expect(product && 'brand' in product ? product.brand : undefined).toBeUndefined();
    expect(product && 'brandId' in product ? product.brandId : undefined).toBeUndefined();
  });

  it('no crea un producto para una línea de diseño', () => {
    expect(
      unpublishedProductFromQuoteLine(
        {
          serviceType: ServiceType.DISENO_GRAFICO,
          productName: 'Logo',
          quantity: 1,
          unitPrice: 1000,
        },
        'prod-1',
        '2026-10-21T12:00:00.000Z',
      ),
    ).toBeNull();
  });
});
