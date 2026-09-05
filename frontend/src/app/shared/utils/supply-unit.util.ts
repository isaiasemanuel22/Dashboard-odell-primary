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

export function computeSupplyPurchaseDelta(
  amountSpent: number,
  quantity: number,
  unitPrice: number,
): number {
  return Math.round(amountSpent - quantity * unitPrice);
}
