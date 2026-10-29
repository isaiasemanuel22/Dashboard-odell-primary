import { BadRequestException } from '@nestjs/common';
import {
  FilamentPriceConfig,
  FilamentTypeConfig,
  GeneralSettings,
} from '../common/interfaces';
import {
  DEFAULT_FILAMENT_TYPE_CATALOG,
  filamentTypeCodeFromName,
  filamentTypeIdForCode,
} from '../store/default-filament-types.seed';

export function normalizeFilamentTypeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export function ensureFilamentTypeCatalog(
  settings: GeneralSettings,
): FilamentTypeConfig[] {
  if (!settings.filamentTypes) {
    settings.filamentTypes = [];
  }
  return settings.filamentTypes;
}

/** Semilla de tipos conocidos solo si el catálogo está vacío (carga desde DB). */
export function seedDefaultFilamentTypesIfEmpty(
  settings: GeneralSettings,
): FilamentTypeConfig[] {
  const catalog = ensureFilamentTypeCatalog(settings);
  if (catalog.length) {
    return catalog;
  }
  settings.filamentTypes = DEFAULT_FILAMENT_TYPE_CATALOG.map((entry) => ({
    ...entry,
  }));
  return settings.filamentTypes;
}

/** Completa filamentTypeId en precios legacy. seedIfEmpty solo al cargar desde DB. */
export function hydrateFilamentPricesWithTypeIds(
  settings: GeneralSettings,
  options: { seedIfEmpty?: boolean } = {},
): void {
  const catalog = options.seedIfEmpty
    ? seedDefaultFilamentTypesIfEmpty(settings)
    : ensureFilamentTypeCatalog(settings);
  for (const price of settings.filamentPrices ?? []) {
    if (price.filamentTypeId) {
      const typed = catalog.find((entry) => entry.id === price.filamentTypeId);
      if (typed && !price.materialType) {
        price.materialType = filamentTypeCodeFromName(typed.name);
      }
      continue;
    }
    const code = String(price.materialType ?? '')
      .trim()
      .toLowerCase();
    if (!code) continue;
    let typeId = filamentTypeIdForCode(code);
    if (!typeId) {
      const byName = catalog.find(
        (entry) => entry.name.toLowerCase() === code,
      );
      typeId = byName?.id;
    }
    if (!typeId) {
      const created: FilamentTypeConfig = {
        id: `ft_${code.replace(/[^a-z0-9]+/g, '_')}`.replace(/_+/g, '_'),
        name: price.materialType,
      };
      if (!catalog.some((entry) => entry.id === created.id)) {
        catalog.push(created);
      }
      typeId = created.id;
    }
    price.filamentTypeId = typeId;
  }
}

export function findFilamentTypeById(
  catalog: FilamentTypeConfig[],
  id: string,
): FilamentTypeConfig | undefined {
  return catalog.find((entry) => entry.id === id);
}

export function findFilamentTypeByName(
  catalog: FilamentTypeConfig[],
  name: string,
): FilamentTypeConfig | undefined {
  const normalized = normalizeFilamentTypeName(name).toLowerCase();
  return catalog.find(
    (entry) => entry.name.toLowerCase() === normalized,
  );
}

export function resolveFilamentTypeForPrice(
  settings: GeneralSettings,
  data: { filamentTypeId?: string; materialType?: string },
): { filamentTypeId: string; materialType: string } {
  const catalog = ensureFilamentTypeCatalog(settings);
  if (data.filamentTypeId) {
    const typed = findFilamentTypeById(catalog, data.filamentTypeId);
    if (!typed) {
      throw new BadRequestException('Tipo de filamento no encontrado');
    }
    return {
      filamentTypeId: typed.id,
      materialType: filamentTypeCodeFromName(typed.name),
    };
  }
  if (data.materialType?.trim()) {
    const code = data.materialType.trim().toLowerCase();
    const byCodeId = filamentTypeIdForCode(code);
    const typed =
      (byCodeId ? findFilamentTypeById(catalog, byCodeId) : undefined) ??
      findFilamentTypeByName(catalog, data.materialType);
    if (!typed) {
      throw new BadRequestException(
        'Tipo de filamento no encontrado; crealo en el catálogo primero',
      );
    }
    return {
      filamentTypeId: typed.id,
      materialType: filamentTypeCodeFromName(typed.name),
    };
  }
  throw new BadRequestException('filamentTypeId es obligatorio');
}

export function filamentTypeLabel(
  settings: GeneralSettings,
  price: FilamentPriceConfig,
): string {
  const catalog = settings.filamentTypes ?? [];
  if (price.filamentTypeId) {
    const typed = findFilamentTypeById(catalog, price.filamentTypeId);
    if (typed) return typed.name;
  }
  return String(price.materialType ?? '');
}
