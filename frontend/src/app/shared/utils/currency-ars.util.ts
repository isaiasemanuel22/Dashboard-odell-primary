/** Pesos enteros, el mismo formato que el pipe `currencyArs`. */
export function formatCurrencyArs(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(value);
}

/** Igual que `formatCurrencyArs` pero conserva los centavos si los hay (siempre 2 decimales). */
export function formatCurrencyArsExact(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Número para editar a mano, en formato argentino y sin miles: 1500,5 */
export function formatArsAmountEditable(value: number): string {
  return String(value).replace('.', ',');
}

/**
 * Texto escrito por el usuario a número, con convención argentina: la coma es
 * el decimal y el punto separa miles ("1.500" = 1500, "1.500,50" = 1500,5).
 * Sin coma, un punto solo cuenta como decimal si no forma grupos de 3 dígitos
 * ("1.5" = 1,5). Máximo 2 decimales (centavos). Devuelve null si no hay número.
 */
export function parseArsAmount(raw: string): number | null {
  const text = (raw ?? '').trim();
  const negative = text.startsWith('-');
  const body = text.replace(/[^\d.,]/g, '');
  if (!/\d/.test(body)) return null;

  let normalized: string;
  if (body.includes(',')) {
    const lastComma = body.lastIndexOf(',');
    normalized = `${body.slice(0, lastComma).replace(/[.,]/g, '')}.${body
      .slice(lastComma + 1)
      .replace(/[.,]/g, '')}`;
  } else if (/^\d{1,3}(\.\d{3})+$/.test(body)) {
    normalized = body.replace(/\./g, '');
  } else {
    const lastDot = body.lastIndexOf('.');
    normalized =
      lastDot < 0
        ? body
        : `${body.slice(0, lastDot).replace(/\./g, '')}.${body.slice(lastDot + 1)}`;
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.round(parsed * 100) / 100;
  return negative ? -rounded : rounded;
}
