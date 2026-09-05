import { FilamentType, PaperType, ProductType, ResinType, SupplyCategory } from '../../core/models';
import {
  FILAMENT_TYPE_LABELS,
  PAPER_TYPE_LABELS,
  PRODUCT_TYPE_LABELS,
  RESIN_TYPE_LABELS,
  SUPPLY_CATEGORY_LABELS,
} from '../constants/labels';
import type { DbSelectOption } from '@dashboard-form/db-select/db-select.types';

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

export const supplyCategoryOptions = (): DbSelectOption[] =>
  labelsToSelectOptions(SUPPLY_CATEGORY_LABELS);
