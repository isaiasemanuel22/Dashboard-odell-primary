import { SupplyCategory, SupplyType } from '../common/enums';

const SUPPLY_TYPES_BY_CATEGORY: Record<SupplyCategory, SupplyType[]> = {
  [SupplyCategory.FDM]: [SupplyType.FILAMENTO],
  [SupplyCategory.RESINA]: [SupplyType.RESINA, SupplyType.ALCOHOL],
  [SupplyCategory.ESTAMPADO]: [
    SupplyType.TINTA,
    SupplyType.REMERA,
    SupplyType.TAZA,
    SupplyType.BUZO,
    SupplyType.GORRA,
    SupplyType.FILM,
    SupplyType.VINILO,
  ],
  [SupplyCategory.GENERAL]: [SupplyType.OTRO],
};

export function inferSupplyCategory(type: SupplyType): SupplyCategory {
  for (const [category, types] of Object.entries(SUPPLY_TYPES_BY_CATEGORY)) {
    if (types.includes(type)) {
      return category as SupplyCategory;
    }
  }
  return SupplyCategory.GENERAL;
}

export function supplyTypesForCategory(category: SupplyCategory): SupplyType[] {
  return SUPPLY_TYPES_BY_CATEGORY[category] ?? [SupplyType.OTRO];
}

export function defaultSupplyTypeForCategory(
  category: SupplyCategory,
): SupplyType {
  return supplyTypesForCategory(category)[0] ?? SupplyType.OTRO;
}
