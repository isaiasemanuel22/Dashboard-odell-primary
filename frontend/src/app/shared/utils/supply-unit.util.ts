import { SupplyCategory } from '../../core/models';

const DEFAULT_UNITS: Record<SupplyCategory, string> = {
  [SupplyCategory.FDM]: 'kg',
  [SupplyCategory.RESINA]: 'L',
  [SupplyCategory.ESTAMPADO]: 'unidad',
  [SupplyCategory.GENERAL]: 'unidad',
};

export function defaultSupplyUnit(category: SupplyCategory): string {
  return DEFAULT_UNITS[category] ?? 'unidad';
}

export interface SupplyUnitOption {
  value: string;
  label: string;
}

const UNIT_LABELS: Record<string, string> = {
  unidad: 'Unidad',
  kg: 'Kilogramo (kg)',
  g: 'Gramo (g)',
  L: 'Litro (L)',
  ml: 'Mililitro (ml)',
  m: 'Metro (m)',
  cm: 'Centímetro (cm)',
  hoja: 'Hoja',
  rollo: 'Rollo',
};

export function supplyUnitOptions(current?: string): SupplyUnitOption[] {
  const values = new Set(Object.values(DEFAULT_UNITS));
  if (current) values.add(current);

  return Array.from(values).map((value) => ({
    value,
    label: UNIT_LABELS[value] ?? value,
  }));
}

/** Etiqueta corta para listas mobile: «u.» / «kg» / «ml». */
export function abbreviateSupplyUnit(unit: string | null | undefined): string {
  const raw = (unit ?? '').trim();
  if (!raw) return 'u.';
  if (/^unidad(es)?$/i.test(raw)) return 'u.';
  return raw;
}

export function computeSupplyPurchaseDelta(
  amountSpent: number,
  quantity: number,
  unitPrice: number,
): number {
  return Math.round(amountSpent - quantity * unitPrice);
}

function roundSupplyAmount(value: number, digits = 2): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function formatSupplyNumber(value: number): string {
  return value.toLocaleString('es-AR', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });
}

/**
 * Cantidad legible en la unidad del insumo.
 * kg/L < 1 → g/ml; si no, hasta 2 decimales con coma (es-AR).
 */
export function formatSupplyQuantity(
  quantity: number,
  unit: string | null | undefined,
): string {
  const rawUnit = (unit ?? '').trim();
  const amount = Number(quantity);
  if (!Number.isFinite(amount)) {
    return rawUnit ? `0 ${rawUnit}` : '0';
  }

  if (rawUnit === 'kg') {
    if (Math.abs(amount) > 0 && Math.abs(amount) < 1) {
      return `${formatSupplyNumber(Math.round(amount * 1000))} g`;
    }
    return `${formatSupplyNumber(roundSupplyAmount(amount))} kg`;
  }

  if (rawUnit === 'L' || rawUnit === 'l') {
    if (Math.abs(amount) > 0 && Math.abs(amount) < 1) {
      return `${formatSupplyNumber(Math.round(amount * 1000))} ml`;
    }
    return `${formatSupplyNumber(roundSupplyAmount(amount))} L`;
  }

  if (!rawUnit) {
    return formatSupplyNumber(roundSupplyAmount(amount));
  }

  const isDiscrete =
    /^unidad(es)?$/i.test(rawUnit) ||
    rawUnit === 'g' ||
    rawUnit === 'ml' ||
    rawUnit === 'hoja' ||
    rawUnit === 'rollo';
  const rounded = isDiscrete
    ? Math.abs(amount - Math.round(amount)) < 1e-9
      ? Math.round(amount)
      : roundSupplyAmount(amount)
    : roundSupplyAmount(amount);
  return `${formatSupplyNumber(rounded)} ${rawUnit}`;
}
