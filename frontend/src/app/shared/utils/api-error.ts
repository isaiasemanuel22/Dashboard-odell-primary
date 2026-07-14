/** Extrae mensaje legible de errores HTTP (NestJS validation, etc.). */
export function extractApiErrorMessage(
  err: { error?: { message?: string | string[] } },
  fallback = 'Ocurrió un error',
): string {
  const message = err.error?.message;
  if (Array.isArray(message)) {
    return message.join(', ');
  }
  if (typeof message === 'string' && message.trim()) {
    return message;
  }
  return fallback;
}
