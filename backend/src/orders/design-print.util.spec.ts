import { PaperType, ServiceType } from '../common/enums';
import { OrderItem } from '../common/interfaces';
import {
  designPrintTaskName,
  hasValidDesignPrintSize,
  isDesignPrintConfigured,
} from './design-print.util';

describe('design-print.util', () => {
  const baseItem = (): OrderItem => ({
    serviceType: ServiceType.DISENO_GRAFICO,
    productName: 'Logo personalizado',
    quantity: 2,
    unitPrice: 15000,
    includesPrint: true,
    printPaperType: PaperType.DTF,
    printWidthCm: 30,
    printLengthCm: 40,
  });

  it('validates print size', () => {
    expect(hasValidDesignPrintSize({ printWidthCm: 10, printLengthCm: 20 })).toBe(
      true,
    );
    expect(hasValidDesignPrintSize({ printWidthCm: 0, printLengthCm: 20 })).toBe(
      false,
    );
  });

  it('detects configured design print lines', () => {
    expect(isDesignPrintConfigured(baseItem())).toBe(true);
    expect(
      isDesignPrintConfigured({ ...baseItem(), printPaperType: undefined }),
    ).toBe(false);
  });

  it('builds production task name with dimensions', () => {
    expect(
      designPrintTaskName({
        ...baseItem(),
        productionRequiredQuantity: 2,
      }),
    ).toBe('Imprimir 2× Logo personalizado (30×40 cm)');
  });
});
