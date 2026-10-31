/** Extrae mensaje legible de errores HTTP (NestJS validation, etc.). */
export function extractApiErrorMessage(
  err: { error?: { message?: string | string[] } },
  fallback = 'Ocurrió un error',
): string {
  const message = err.error?.message;
  if (Array.isArray(message)) {
    return message.map(translateValidationMessage).join(', ');
  }
  if (typeof message === 'string' && message.trim()) {
    return translateValidationMessage(message);
  }
  return fallback;
}

/** class-validator responde en inglés; en pantalla se muestra en español. */
export function translateValidationMessage(raw: string): string {
  const text = raw.trim();
  if (/must be an email/i.test(text)) return 'El email no es válido';
  if (/must match .*(regular expression|\\d\{2\}:\\d\{2\})/i.test(text)) {
    return 'La hora tiene que tener el formato HH:MM';
  }
  if (/should not be empty/i.test(text)) return 'Falta un dato obligatorio';
  if (/must be a (string|number|boolean|date)/i.test(text)) {
    return 'El dato no tiene el formato esperado';
  }
  if (/must be (longer|shorter|a positive)/i.test(text)) {
    return 'El valor no está en el rango permitido';
  }
  if (/\bmust\b/i.test(text) && !/[áéíóúñ]/i.test(text)) {
    return 'Revisá los datos: hay un valor que no es válido';
  }
  return text;
}
