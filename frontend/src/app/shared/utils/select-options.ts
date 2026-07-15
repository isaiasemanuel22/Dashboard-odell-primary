import { FilamentType, PaperType, ProductType, ResinType, SupplyCategory, SupplyType } from '../../core/models';
import {
  FILAMENT_TYPE_LABELS,
  PAPER_TYPE_LABELS,
  PRODUCT_TYPE_LABELS,
  RESIN_TYPE_LABELS,
  SUPPLY_CATEGORY_LABELS,
  SUPPLY_TYPE_LABELS,
} from '../constants/labels';
import { DbSelectOption } from '@general-components';

export function labelsToSelectOptions<T extends string>(
  labels: Record<T, string>,
): { value: T; label: string }[] {
  return (Object.keys(labels) as T[]).map((value) => ({
    value,
    label: labels[value],
  }));
}

export const productTypeOptions = (): { value: ProductType; label: string }[] =>
  labelsToSelectOptions(PRODUCT_TYPE_LABELS);

export const filamentTypeOptions = (): { value: FilamentType; label: string }[] =>
  labelsToSelectOptions(FILAMENT_TYPE_LABELS);

export const resinTypeOptions = (): { value: ResinType; label: string }[] =>
  labelsToSelectOptions(RESIN_TYPE_LABELS);

export const paperTypeOptions = (): { value: PaperType; label: string }[] =>
  labelsToSelectOptions(PAPER_TYPE_LABELS);

export const supplyTypeOptions = (): DbSelectOption[] =>
  labelsToSelectOptions(SUPPLY_TYPE_LABELS);

export const supplyCategoryOptions = (): DbSelectOption[] =>
  labelsToSelectOptions(SUPPLY_CATEGORY_LABELS);

export function supplyTypeOptionsForCategory(
  category: SupplyCategory,
): DbSelectOption[] {
  return supplyTypeOptions().filter((option) =>
    supplyTypesForCategory(category).includes(option.value as SupplyType),
  );
}

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

export function supplyTypesForCategory(category: SupplyCategory): SupplyType[] {
  return SUPPLY_TYPES_BY_CATEGORY[category] ?? [SupplyType.OTRO];
}

export function inferSupplyCategory(type: SupplyType): SupplyCategory {
  for (const [category, types] of Object.entries(SUPPLY_TYPES_BY_CATEGORY)) {
    if (types.includes(type)) {
      return category as SupplyCategory;
    }
  }
  return SupplyCategory.GENERAL;
}
