import { QuoteStatus } from '../common/enums';
import { isQuoteExpired, quoteValidUntilYmd } from './quote-validity.util';

describe('quote-validity.util', () => {
  const quotedAt = '2026-10-21T12:00:00.000Z';

  it('validez = emisión + 15 días', () => {
    expect(quoteValidUntilYmd(quotedAt)).toBe('2026-11-05');
  });

  it('vence recién el día siguiente al último día válido (AR)', () => {
    const quote = { status: QuoteStatus.ENVIADO, quotedAt };
    expect(isQuoteExpired(quote, new Date('2026-11-05T20:00:00-03:00'))).toBe(
      false,
    );
    expect(isQuoteExpired(quote, new Date('2026-11-06T00:30:00-03:00'))).toBe(
      true,
    );
  });

  it('solo Borrador y Enviado pueden estar vencidos', () => {
    const now = new Date('2027-01-01T12:00:00-03:00');
    expect(
      isQuoteExpired({ status: QuoteStatus.BORRADOR, quotedAt }, now),
    ).toBe(true);
    expect(
      isQuoteExpired({ status: QuoteStatus.ACEPTADO, quotedAt }, now),
    ).toBe(false);
    expect(
      isQuoteExpired({ status: QuoteStatus.RECHAZADO, quotedAt }, now),
    ).toBe(false);
  });
});
