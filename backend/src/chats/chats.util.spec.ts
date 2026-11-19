import { chatWindow, normalizeSearchText, onlyDigits } from './chats.util';

describe('chats.util', () => {
  const now = new Date('2026-11-18T12:00:00.000Z');

  it('la ventana dura 24 h desde el último mensaje del cliente', () => {
    expect(chatWindow('2026-11-17T12:30:00.000Z', now)).toEqual({
      open: true,
      expiresAt: '2026-11-18T12:30:00.000Z',
    });
    expect(chatWindow('2026-11-17T11:59:00.000Z', now).open).toBe(false);
  });

  it('sin mensajes del cliente la ventana está cerrada', () => {
    expect(chatWindow(null, now)).toEqual({ open: false, expiresAt: null });
  });

  it('normaliza texto y dígitos para buscar', () => {
    expect(normalizeSearchText('  Lucía FERNÁNDEZ ')).toBe('lucia fernandez');
    expect(onlyDigits('+54 11 4421-9087')).toBe('541144219087');
  });
});
