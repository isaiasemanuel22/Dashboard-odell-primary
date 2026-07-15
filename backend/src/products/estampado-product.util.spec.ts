import { PaperType } from '../common/enums';
import {
  formatPrintDimensionsCm,
  hasValidPrintSize,
  normalizeEstampadoPressCycles,
  normalizeEstampadoPrints,
  resolvePrintAreaSecondCm,
  totalEstampadoPressMinutes,
} from './estampado-product.util';

describe('estampado-product.util', () => {
  it('normaliza bajadas múltiples en minutos totales de plancha', () => {
    const total = totalEstampadoPressMinutes([
      { id: '1', pressMinutes: 2, bajadas: 2 },
      { id: '2', pressMinutes: 1.5, bajadas: 1 },
    ]);

    expect(total).toBe(5.5);
  });

  it('migra un impreso legacy a arreglo de prints', () => {
    const prints = normalizeEstampadoPrints(undefined, {
      paperType: PaperType.DTF,
      impresoId: 'imp-1',
      widthCm: 10,
      heightCm: 10,
    });

    expect(prints).toHaveLength(1);
    expect(prints[0].impresoId).toBe('imp-1');
  });

  it('usa largo como segunda dimensión de área cuando está definido', () => {
    expect(resolvePrintAreaSecondCm(20, 10)).toBe(20);
    expect(resolvePrintAreaSecondCm(undefined, 10)).toBe(10);
  });

  it('formatea ancho, largo y alto', () => {
    expect(formatPrintDimensionsCm(10, 20, 5)).toBe('10 × 20 × 5 cm');
    expect(formatPrintDimensionsCm(10, undefined, 5)).toBe('10 × 5 cm');
  });

  it('valida tamaño con ancho y alto o largo', () => {
    expect(hasValidPrintSize(10, undefined, 5)).toBe(true);
    expect(hasValidPrintSize(10, 20, undefined)).toBe(true);
    expect(hasValidPrintSize(0, 20, 5)).toBe(false);
  });
});
