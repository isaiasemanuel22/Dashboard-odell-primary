import { whatsAppDigitsAr } from './quote-share.util';

describe('whatsAppDigitsAr', () => {
  it('saca el 0 y el 15 de un número con área de 3 dígitos', () => {
    expect(whatsAppDigitsAr('0223 15 677-3255')).toBe('5492236773255');
  });

  it('saca el 15 con área de 2 dígitos (Buenos Aires)', () => {
    expect(whatsAppDigitsAr('011 15 5555-1234')).toBe('5491155551234');
    expect(whatsAppDigitsAr('11 15 5555 1234')).toBe('5491155551234');
  });

  it('acepta el formato internacional con 9', () => {
    expect(whatsAppDigitsAr('+54 9 223 677-3255')).toBe('5492236773255');
    expect(whatsAppDigitsAr('5491155551234')).toBe('5491155551234');
  });

  it('agrega el 9 cuando viene +54 sin 9', () => {
    expect(whatsAppDigitsAr('+54 11 5555-1234')).toBe('5491155551234');
  });

  it('acepta el número nacional de 10 dígitos', () => {
    expect(whatsAppDigitsAr('223 677 3255')).toBe('5492236773255');
  });

  it('devuelve vacío sin teléfono', () => {
    expect(whatsAppDigitsAr('')).toBe('');
    expect(whatsAppDigitsAr(null)).toBe('');
    expect(whatsAppDigitsAr('sin teléfono')).toBe('');
  });
});
