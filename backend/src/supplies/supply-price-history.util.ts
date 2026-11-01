export interface SupplyPriceHistoryEntry {
  at: string;
  unitPrice: number;
}

export const MAX_SUPPLY_PRICE_HISTORY = 50;

/** Agrega el precio NUEVO al historial y deja como máximo 50 entradas. */
export function appendSupplyPriceHistory(
  history: SupplyPriceHistoryEntry[] | undefined | null,
  unitPrice: number,
  at = new Date().toISOString(),
): SupplyPriceHistoryEntry[] {
  const previous = Array.isArray(history) ? [...history] : [];
  previous.push({
    at,
    unitPrice: Number(unitPrice) || 0,
  });
  if (previous.length <= MAX_SUPPLY_PRICE_HISTORY) {
    return previous;
  }
  return previous.slice(previous.length - MAX_SUPPLY_PRICE_HISTORY);
}

export function normalizeSupplyPriceHistory(
  raw: unknown,
): SupplyPriceHistoryEntry[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const at = typeof record.at === 'string' ? record.at : null;
      const unitPrice = Number(record.unitPrice);
      if (!at || !Number.isFinite(unitPrice)) return null;
      return { at, unitPrice };
    })
    .filter((entry): entry is SupplyPriceHistoryEntry => entry !== null);
}
