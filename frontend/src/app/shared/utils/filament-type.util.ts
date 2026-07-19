import { FilamentPriceConfig, FilamentType } from '../../core/models';
import { FILAMENT_TYPE_LABELS } from '../constants/labels';
import { DbAutocompleteOption } from '@general-components';
import { filamentTypeOptions } from './select-options';

export function normalizeFilamentType(value: string): string {
  return value.trim().toLowerCase();
}

export function filamentTypeDisplayLabel(value: string): string {
  return FILAMENT_TYPE_LABELS[value as FilamentType] ?? value.toUpperCase();
}

export function buildFilamentTypeOptions(
  prices: FilamentPriceConfig[] = [],
  extraTypes: string[] = [],
): DbAutocompleteOption[] {
  const byValue = new Map<string, DbAutocompleteOption>();

  for (const option of filamentTypeOptions()) {
    byValue.set(option.value, option);
  }

  for (const price of prices) {
    const normalized = normalizeFilamentType(price.materialType);
    if (!normalized || byValue.has(normalized)) continue;
    byValue.set(normalized, {
      value: normalized,
      label: filamentTypeDisplayLabel(normalized),
    });
  }

  for (const type of extraTypes) {
    const normalized = normalizeFilamentType(type);
    if (!normalized || byValue.has(normalized)) continue;
    byValue.set(normalized, {
      value: normalized,
      label: filamentTypeDisplayLabel(normalized),
    });
  }

  return Array.from(byValue.values()).sort((a, b) =>
    a.label.localeCompare(b.label, 'es'),
  );
}
