import { BadRequestException } from '@nestjs/common';
import {
  GeneralSettings,
  ResinPriceConfig,
  ResinTypeConfig,
} from '../common/interfaces';
import {
  DEFAULT_RESIN_TYPE_CATALOG,
  resinTypeCodeFromName,
  resinTypeIdForCode,
} from '../store/default-resin-types.seed';

export function normalizeResinTypeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export function ensureResinTypeCatalog(
  settings: GeneralSettings,
): ResinTypeConfig[] {
  if (!settings.resinTypes) {
    settings.resinTypes = [];
  }
  return settings.resinTypes;
}

/** Semilla de tipos conocidos solo si el catálogo está vacío (carga desde DB). */
export function seedDefaultResinTypesIfEmpty(
  settings: GeneralSettings,
): ResinTypeConfig[] {
  const catalog = ensureResinTypeCatalog(settings);
  if (catalog.length) {
    return catalog;
  }
  settings.resinTypes = DEFAULT_RESIN_TYPE_CATALOG.map((entry) => ({
    ...entry,
  }));
  return settings.resinTypes;
}

/** Completa resinTypeId en precios legacy. seedIfEmpty solo al cargar desde DB. */
export function hydrateResinPricesWithTypeIds(
  settings: GeneralSettings,
  options: { seedIfEmpty?: boolean } = {},
): void {
  const catalog = options.seedIfEmpty
    ? seedDefaultResinTypesIfEmpty(settings)
    : ensureResinTypeCatalog(settings);
  for (const price of settings.resinPrices ?? []) {
    if (price.resinTypeId) {
      const typed = catalog.find((entry) => entry.id === price.resinTypeId);
      if (typed && !price.resinType) {
        price.resinType = resinTypeCodeFromName(typed.name);
      }
      continue;
    }
    const code = String(price.resinType ?? '')
      .trim()
      .toLowerCase();
    if (!code) continue;
    let typeId = resinTypeIdForCode(code);
    if (!typeId) {
      const byName = catalog.find(
        (entry) =>
          entry.name.toLowerCase() === code ||
          resinTypeCodeFromName(entry.name) === code,
      );
      typeId = byName?.id;
    }
    if (!typeId) {
      const created: ResinTypeConfig = {
        id: `rt_${code.replace(/[^a-z0-9]+/g, '_')}`.replace(/_+/g, '_'),
        name: String(price.resinType),
      };
      if (!catalog.some((entry) => entry.id === created.id)) {
        catalog.push(created);
      }
      typeId = created.id;
    }
    price.resinTypeId = typeId;
  }
}

export function findResinTypeById(
  catalog: ResinTypeConfig[],
  id: string,
): ResinTypeConfig | undefined {
  return catalog.find((entry) => entry.id === id);
}

export function findResinTypeByName(
  catalog: ResinTypeConfig[],
  name: string,
): ResinTypeConfig | undefined {
  const normalized = normalizeResinTypeName(name).toLowerCase();
  return catalog.find((entry) => entry.name.toLowerCase() === normalized);
}

export function resolveResinTypeForPrice(
  settings: GeneralSettings,
  data: { resinTypeId?: string; resinType?: string },
): { resinTypeId: string; resinType: string } {
  const catalog = ensureResinTypeCatalog(settings);
  if (data.resinTypeId) {
    const typed = findResinTypeById(catalog, data.resinTypeId);
    if (!typed) {
      throw new BadRequestException('Tipo de resina no encontrado');
    }
    return {
      resinTypeId: typed.id,
      resinType: resinTypeCodeFromName(typed.name),
    };
  }
  if (data.resinType?.trim()) {
    const code = data.resinType.trim().toLowerCase();
    const byCodeId = resinTypeIdForCode(code);
    const typed =
      (byCodeId ? findResinTypeById(catalog, byCodeId) : undefined) ??
      findResinTypeByName(catalog, data.resinType) ??
      catalog.find((entry) => resinTypeCodeFromName(entry.name) === code);
    if (!typed) {
      throw new BadRequestException(
        'Tipo de resina no encontrado; crealo en el catálogo primero',
      );
    }
    return {
      resinTypeId: typed.id,
      resinType: resinTypeCodeFromName(typed.name),
    };
  }
  throw new BadRequestException('resinTypeId es obligatorio');
}

export function resinTypeLabel(
  settings: GeneralSettings,
  price: ResinPriceConfig,
): string {
  const catalog = settings.resinTypes ?? [];
  if (price.resinTypeId) {
    const typed = findResinTypeById(catalog, price.resinTypeId);
    if (typed) return typed.name;
  }
  return String(price.resinType ?? '');
}
