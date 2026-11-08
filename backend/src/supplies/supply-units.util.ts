import { SupplyCategory } from '../common/enums';
import { Supply } from '../common/interfaces';

/** Normaliza la unidad a minúsculas sin espacios. */
export function normalizeSupplyUnit(unit: string | null | undefined): string {
  return (unit ?? '').trim().toLowerCase();
}

/** Convierte cantidad del supply a gramos (o ml para resina). */
export function supplyQuantityToGrams(
  supply: Pick<Supply, 'quantity' | 'unit' | 'category'>,
): number {
  const quantity = Number(supply.quantity) || 0;
  const unit = normalizeSupplyUnit(supply.unit);
  if (unit === 'kg' || unit === 'l') return quantity * 1000;
  if (unit === 'g' || unit === 'ml') return quantity;
  if (
    supply.category === SupplyCategory.FDM ||
    supply.category === SupplyCategory.RESINA
  ) {
    // Compat: stockUnits histórico asumía kg/L.
    return quantity * 1000;
  }
  return quantity;
}

/** Convierte gramos (o ml) a la unidad del supply. */
export function gramsToSupplyQuantity(
  supply: Pick<Supply, 'unit' | 'category'>,
  grams: number,
): number {
  const amount = Number(grams) || 0;
  const unit = normalizeSupplyUnit(supply.unit);
  if (unit === 'kg' || unit === 'l') return amount / 1000;
  if (unit === 'g' || unit === 'ml') return amount;
  if (
    supply.category === SupplyCategory.FDM ||
    supply.category === SupplyCategory.RESINA
  ) {
    return amount / 1000;
  }
  return amount;
}

/** Peso por bobina en gramos; default 1000 para filamentos si es null. */
export function resolveSpoolGrams(
  supply: Pick<Supply, 'spoolGrams' | 'category'>,
): number {
  if (supply.spoolGrams != null && Number.isFinite(Number(supply.spoolGrams))) {
    const value = Math.trunc(Number(supply.spoolGrams));
    if (value > 0) return value;
  }
  if (supply.category === SupplyCategory.FDM) return 1000;
  return 1000;
}

/** Formatea gramos abiertos en la unidad del supply para mensajes. */
export function formatOpenSpoolsLabel(
  supply: Pick<Supply, 'unit' | 'category'>,
  openGrams: number,
): string {
  const qty = gramsToSupplyQuantity(supply, openGrams);
  const unit = normalizeSupplyUnit(supply.unit) || 'g';
  const rounded = Math.round(qty * 1000) / 1000;
  const text = Number.isInteger(rounded)
    ? String(rounded)
    : String(rounded).replace(/\.?0+$/, '');
  return `${text} ${unit}`;
}
