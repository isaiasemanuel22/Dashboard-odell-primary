import { ProductType } from '../../core/models';
import {
  FILAMENT_TYPE_LABELS,
  PRODUCT_TYPE_LABELS,
  RESIN_TYPE_LABELS,
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

export const filamentTypeOptions = (): DbSelectOption[] =>
  labelsToSelectOptions(FILAMENT_TYPE_LABELS);

export const resinTypeOptions = (): DbSelectOption[] =>
  labelsToSelectOptions(RESIN_TYPE_LABELS);

export const supplyTypeOptions = (): DbSelectOption[] =>
  labelsToSelectOptions(SUPPLY_TYPE_LABELS);
