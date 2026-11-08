import { ServiceType } from '../../core/models';
import {
  formatOrderMobileDeliveryLabel,
  isLineBlank,
  isLineValid,
  isValidLineQuantity,
  lineQuantityError,
  lineUnitPriceError,
  lineValidationMessage,
  pluralize,
  toDateInputValue,
} from './order.helpers';
import { discountValidationMessage } from './discount.util';
import type { OrderLineDraft } from '../../core/models';

function baseLine(overrides: Partial<OrderLineDraft> = {}): OrderLineDraft {
  return {
    serviceType: ServiceType.IMPRESION_3D,
    quantity: 1,
    unitPrice: 1000,
    customName: 'Pieza',
    grams: 10,
    filamentType: 'PLA' as OrderLineDraft['filamentType'],
    printTimeHours: 1,
    ...overrides,
  };
}

describe('B9 order line validations', () => {
  it('rejects non-integer and <1 quantities', () => {
    expect(isValidLineQuantity(2.5)).toBe(false);
    expect(isValidLineQuantity(-2)).toBe(false);
    expect(isValidLineQuantity(0)).toBe(false);
    expect(isValidLineQuantity(1)).toBe(true);
    expect(lineQuantityError(2.5)).toContain('entero');
    expect(lineQuantityError(-2)).toContain('mayor o igual a 1');
  });

  it('rejects negative and zero unit price', () => {
    expect(lineUnitPriceError(baseLine({ unitPrice: -10 }))).toContain(
      'negativo',
    );
    expect(lineUnitPriceError(baseLine({ unitPrice: 0 }))).toContain(
      'mayor a 0',
    );
    expect(lineUnitPriceError(baseLine({ unitPrice: 100 }))).toBe('');
  });

  it('blocks invalid lines in isLineValid', () => {
    expect(isLineValid(baseLine({ quantity: 2.5 }))).toBe(false);
    expect(isLineValid(baseLine({ unitPrice: 0 }))).toBe(false);
    expect(isLineValid(baseLine())).toBe(true);
  });

  it('marks empty default line as blank', () => {
    expect(
      isLineBlank({
        serviceType: ServiceType.IMPRESION_3D,
        quantity: 1,
        unitPrice: 0,
      }),
    ).toBe(true);
    expect(isLineBlank(baseLine({ quantity: -2 }))).toBe(false);
  });

  it('rejects negative discounts', () => {
    expect(discountValidationMessage('amount', 0, -3000)).toContain(
      'negativo',
    );
    expect(discountValidationMessage('percent', -3, 0)).toContain('negativo');
    expect(discountValidationMessage('amount', 0, 100, 500)).toBe('');
    expect(discountValidationMessage('percent', 150, 0, 10_000)).toContain(
      '99%',
    );
    expect(discountValidationMessage('amount', 0, 10_000, 8_000)).toContain(
      'subtotal',
    );
  });

  it('lineValidationMessage prefers quantity errors', () => {
    expect(lineValidationMessage(baseLine({ quantity: 2.5 }))).toContain(
      'entero',
    );
  });

  it('pluralize uses singular only for 1', () => {
    expect(pluralize(0, 'tarea', 'tareas')).toBe('0 tareas');
    expect(pluralize(1, 'tarea', 'tareas')).toBe('1 tarea');
    expect(pluralize(2, 'entrega', 'entregas')).toBe('2 entregas');
  });
});

describe('due date calendar day', () => {
  it('formatOrderMobileDeliveryLabel usa YYYY-MM-DD sin corrimiento de zona', () => {
    const label = formatOrderMobileDeliveryLabel(
      '2026-11-14T00:00:00.000Z',
      false,
    );
    expect(label).toContain('14/11');
    expect(label).not.toContain('13/11');
  });

  it('toDateInputValue toma el día del ISO sin convertir zona', () => {
    expect(toDateInputValue('2026-11-14T00:00:00.000Z')).toBe('2026-11-14');
    expect(toDateInputValue('2026-11-14T18:00:00.000Z')).toBe('2026-11-14');
  });
});
