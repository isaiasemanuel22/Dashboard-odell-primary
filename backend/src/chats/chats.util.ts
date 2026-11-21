/** Ventana de Meta para responder con texto libre: 24 h desde el último mensaje del cliente. */
export const CHAT_WINDOW_MS = 24 * 60 * 60 * 1000;

export function chatWindow(
  lastInboundAt: string | null,
  now: Date,
): { open: boolean; expiresAt: string | null } {
  if (!lastInboundAt) return { open: false, expiresAt: null };
  const expires = new Date(lastInboundAt).getTime() + CHAT_WINDOW_MS;
  return {
    open: now.getTime() < expires,
    expiresAt: new Date(expires).toISOString(),
  };
}

/** Minúsculas, sin tildes ni diacríticos y sin espacios en los bordes. */
export function normalizeSearchText(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function onlyDigits(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '');
}
