import { SupplyCategory } from '../common/enums';

export function defaultSupplyUnit(category: SupplyCategory): string {
  switch (category) {
    case SupplyCategory.FDM:
      return 'kg';
    case SupplyCategory.RESINA:
      return 'L';
    default:
      return 'unidad';
  }
}

export function normalizeSupplyCategory(value?: string): SupplyCategory {
  if (
    value &&
    Object.values(SupplyCategory).includes(value as SupplyCategory)
  ) {
    return value as SupplyCategory;
  }
  return SupplyCategory.GENERAL;
}
