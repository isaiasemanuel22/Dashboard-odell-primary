import {
  FilamentType,
  PaperType,
  ProductType,
  ServiceType,
} from '../common/enums';
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

  it('copia insumos, impresos y bajadas en un producto de estampado', () => {
    const product = unpublishedProductFromQuoteLine(
      {
        serviceType: ServiceType.ESTAMPADO,
        productName: 'Remera custom',
        quantity: 1,
        unitPrice: 8000,
        estampadoSupplies: [
          { id: 'es-1', supplyId: 'sup-1', quantity: 1, colorId: 'indistinto' },
        ],
        estampadoPrints: [
          {
            id: 'ep-1',
            paperType: PaperType.DTF,
            widthCm: 20,
            heightCm: 25,
            label: 'Pecho',
          },
        ],
        estampadoPressCycles: [
          { id: 'ec-1', pressMinutes: 15, bajadas: 1, label: 'Pecho' },
        ],
      },
      'prod-est-1',
      '2026-10-21T12:00:00.000Z',
    );

    expect(product).toMatchObject({
      id: 'prod-est-1',
      name: 'Remera custom',
      type: ProductType.ESTAMPADO,
      published: false,
      price: 8000,
    });
    expect(product && 'supplies' in product ? product.supplies : []).toHaveLength(
      1,
    );
    expect(product && 'prints' in product ? product.prints : []).toHaveLength(1);
    expect(
      product && 'pressCycles' in product ? product.pressCycles : [],
    ).toHaveLength(1);
  });
});
