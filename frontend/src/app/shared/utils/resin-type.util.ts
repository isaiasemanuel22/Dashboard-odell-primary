import {
  GeneralSettings,
  ResinPriceConfig,
  ResinType,
  ResinTypeConfig,
} from '../../core/models';
import { RESIN_TYPE_LABELS } from '../constants/labels';
import type { DbAutocompleteOption } from '@dashboard-form/db-autocomplete/db-autocomplete.types';
import { resolveResinPricePerLiter } from './material-type-price.util';
import { resinTypeOptions } from './select-options';

const KNOWN_TYPE_CODES: Record<string, string> = {
  rt_translucida: ResinType.TRANSLUCIDA,
  rt_dura: ResinType.DURA,
  rt_flexible: ResinType.FLEXIBLE,
  rt_casting: ResinType.CASTING,
  rt_estandar: ResinType.ESTANDAR,
};

export function normalizeResinType(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '_');
}

/** Código usado en productos/insumos a partir del catálogo. */
export function resinTypeCodeFromConfig(entry: ResinTypeConfig): string {
  return KNOWN_TYPE_CODES[entry.id] ?? normalizeResinType(entry.name);
}

export function resinTypeDisplayLabel(
  value: string,
  catalog: ResinTypeConfig[] = [],
): string {
  const byId = catalog.find((entry) => entry.id === value);
  if (byId) return byId.name;
  const byName = catalog.find(
    (entry) => entry.name.toLowerCase() === value.trim().toLowerCase(),
  );
  if (byName) return byName.name;
  const byCode = catalog.find(
    (entry) => resinTypeCodeFromConfig(entry) === normalizeResinType(value),
  );
  if (byCode) return byCode.name;
  return RESIN_TYPE_LABELS[value as ResinType] ?? value;
}

export function buildResinTypeOptions(
  catalog: ResinTypeConfig[] = [],
  prices: ResinPriceConfig[] = [],
  extraTypes: string[] = [],
  valueAs: 'id' | 'code' = 'id',
): DbAutocompleteOption[] {
  const byValue = new Map<string, DbAutocompleteOption>();

  if (catalog.length) {
    for (const entry of catalog) {
      const value =
        valueAs === 'id' ? entry.id : resinTypeCodeFromConfig(entry);
      byValue.set(value, { value, label: entry.name });
    }
  } else {
    for (const option of resinTypeOptions()) {
      byValue.set(option.value, option);
    }
  }

  for (const price of prices) {
    if (valueAs === 'id' && price.resinTypeId) {
      if (byValue.has(price.resinTypeId)) continue;
      byValue.set(price.resinTypeId, {
        value: price.resinTypeId,
        label: resinTypeDisplayLabel(String(price.resinType), catalog),
      });
      continue;
    }
    const key = normalizeResinType(String(price.resinType ?? ''));
    if (!key || byValue.has(key)) continue;
    byValue.set(key, {
      value: key,
      label: resinTypeDisplayLabel(String(price.resinType), catalog),
    });
  }

  for (const type of extraTypes) {
    const normalized = type.trim();
    if (!normalized) continue;
    const existing = [...byValue.values()].find(
      (option) =>
        option.value === normalized ||
        option.label.toLowerCase() === normalized.toLowerCase() ||
        normalizeResinType(option.value) === normalizeResinType(normalized),
    );
    if (existing) continue;
    byValue.set(normalized, {
      value: normalized,
      label: resinTypeDisplayLabel(normalized, catalog),
    });
  }

  return Array.from(byValue.values()).sort((a, b) =>
    a.label.localeCompare(b.label, 'es'),
  );
}

/**
 * Primer tipo de resina con precio configurado (código de catálogo).
 * Si ninguno tiene precio, undefined (el selector queda vacío / obligatorio).
 */
export function defaultPricedResinTypeCode(
  settings: GeneralSettings | null | undefined,
): string | undefined {
  if (!settings) return undefined;
  const options = buildResinTypeOptions(
    settings.resinTypes ?? [],
    settings.resinPrices ?? [],
    [],
    'code',
  );
  const priced = options.find(
    (option) =>
      resolveResinPricePerLiter(settings, String(option.value)) != null,
  );
  return priced ? String(priced.value) : undefined;
}

export function resolveResinTypeIdFromInput(
  raw: string,
  catalog: ResinTypeConfig[],
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
    (entry) => resinTypeCodeFromConfig(entry) === normalizeResinType(value),
  );
  if (byCode) return byCode.id;
  return null;
}
