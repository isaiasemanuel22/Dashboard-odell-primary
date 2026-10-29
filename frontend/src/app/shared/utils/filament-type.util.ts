import {
  FilamentPriceConfig,
  FilamentType,
  FilamentTypeConfig,
} from '../../core/models';
import { FILAMENT_TYPE_LABELS } from '../constants/labels';
import type { DbAutocompleteOption } from '@dashboard-form/db-autocomplete/db-autocomplete.types';
import { filamentTypeOptions } from './select-options';

const KNOWN_TYPE_CODES: Record<string, string> = {
  ft_pla: FilamentType.PLA,
  ft_petg: FilamentType.PETG,
  ft_tpu: FilamentType.TPU,
  ft_abs: FilamentType.ABS,
  ft_asa: FilamentType.ASA,
  ft_nylon: FilamentType.NYLON,
  ft_otro: FilamentType.OTRO,
};

export function normalizeFilamentType(value: string): string {
  return value.trim().toLowerCase();
}

/** Código usado en productos/insumos a partir del catálogo. */
export function filamentTypeCodeFromConfig(entry: FilamentTypeConfig): string {
  return KNOWN_TYPE_CODES[entry.id] ?? normalizeFilamentType(entry.name);
}

export function filamentTypeDisplayLabel(
  value: string,
  catalog: FilamentTypeConfig[] = [],
): string {
  const byId = catalog.find((entry) => entry.id === value);
  if (byId) return byId.name;
  const byName = catalog.find(
    (entry) => entry.name.toLowerCase() === value.trim().toLowerCase(),
  );
  if (byName) return byName.name;
  const byCode = catalog.find(
    (entry) => filamentTypeCodeFromConfig(entry) === normalizeFilamentType(value),
  );
  if (byCode) return byCode.name;
  return FILAMENT_TYPE_LABELS[value as FilamentType] ?? value.toUpperCase();
}

export function buildFilamentTypeOptions(
  catalog: FilamentTypeConfig[] = [],
  prices: FilamentPriceConfig[] = [],
  extraTypes: string[] = [],
  valueAs: 'id' | 'code' = 'id',
): DbAutocompleteOption[] {
  const byValue = new Map<string, DbAutocompleteOption>();

  if (catalog.length) {
    for (const entry of catalog) {
      const value =
        valueAs === 'id' ? entry.id : filamentTypeCodeFromConfig(entry);
      byValue.set(value, { value, label: entry.name });
    }
  } else {
    for (const option of filamentTypeOptions()) {
      byValue.set(option.value, option);
    }
  }

  for (const price of prices) {
    if (valueAs === 'id' && price.filamentTypeId) {
      if (byValue.has(price.filamentTypeId)) continue;
      byValue.set(price.filamentTypeId, {
        value: price.filamentTypeId,
        label: filamentTypeDisplayLabel(price.materialType, catalog),
      });
      continue;
    }
    const key = normalizeFilamentType(price.materialType);
    if (!key || byValue.has(key)) continue;
    byValue.set(key, {
      value: key,
      label: filamentTypeDisplayLabel(price.materialType, catalog),
    });
  }

  for (const type of extraTypes) {
    const normalized = type.trim();
    if (!normalized) continue;
    const existing = [...byValue.values()].find(
      (option) =>
        option.value === normalized ||
        option.label.toLowerCase() === normalized.toLowerCase(),
    );
    if (existing) continue;
    byValue.set(normalized, {
      value: normalized,
      label: filamentTypeDisplayLabel(normalized, catalog),
    });
  }

  return Array.from(byValue.values()).sort((a, b) =>
    a.label.localeCompare(b.label, 'es'),
  );
}

export function resolveFilamentTypeIdFromInput(
  raw: string,
  catalog: FilamentTypeConfig[],
): string | null {
  const value = raw.trim();
  if (!value) return null;
  const byId = catalog.find((entry) => entry.id === value);
  if (byId) return byId.id;
  const byName = catalog.find(
    (entry) => entry.name.toLowerCase() === value.toLowerCase(),
  );
  if (byName) return byName.id;
  const byCode = catalog.find(
    (entry) => filamentTypeCodeFromConfig(entry) === normalizeFilamentType(value),
  );
  if (byCode) return byCode.id;
  return null;
}
