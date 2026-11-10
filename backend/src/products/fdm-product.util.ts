import { FilamentType } from '../common/enums';
import {
  INDISTINTO_COLOR_ID,
  normalizeProductColorId,
} from '../common/color.util';
import { FdmFilamentLine } from '../common/interfaces';

export function createFdmFilamentLineId(): string {
  return `ff-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createEmptyFdmFilamentLine(
  filamentType: FilamentType = FilamentType.PLA,
): FdmFilamentLine {
  return {
    id: createFdmFilamentLineId(),
    filamentType,
    grams: 0,
    colorId: INDISTINTO_COLOR_ID,
  };
}

export function normalizeFdmFilaments(
  raw: unknown,
  legacy?: {
    grams?: number;
    filamentType?: FilamentType;
    brand?: string;
    brandId?: string;
  },
): FdmFilamentLine[] {
  if (Array.isArray(raw) && raw.length) {
    return raw
      .map((item) => normalizeOneFdmFilamentLine(item))
      .filter((item): item is FdmFilamentLine => item !== null);
  }

  const grams = Number(legacy?.grams) || 0;
  if (grams > 0 && legacy?.filamentType) {
    return [
      {
        id: createFdmFilamentLineId(),
        filamentType: legacy.filamentType,
        grams,
        brand: legacy.brand?.trim() || undefined,
        brandId: legacy.brandId,
      },
    ];
  }

  return [];
}

export function totalFdmFilamentGrams(filaments: FdmFilamentLine[]): number {
  return filaments.reduce(
    (sum, line) => sum + Math.max(0, Number(line.grams) || 0),
    0,
  );
}

export function hasValidFdmFilamentInput(
  filaments: FdmFilamentLine[],
): boolean {
  return filaments.some(
    (line) =>
      Number(line.grams) > 0 &&
      Object.values(FilamentType).includes(line.filamentType),
  );
}

export function resolveFdmFilaments(input: {
  filaments?: FdmFilamentLine[];
  grams?: number;
  filamentType?: FilamentType;
  brand?: string;
  brandId?: string;
}): FdmFilamentLine[] {
  return normalizeFdmFilaments(input.filaments, {
    grams: input.grams,
    filamentType: input.filamentType,
    brand: input.brand,
    brandId: input.brandId,
  });
}

export function storedFdmFilaments(
  filaments: FdmFilamentLine[],
): FdmFilamentLine[] {
  return filaments.filter((line) => Number(line.grams) > 0);
}

/** Redondea gramos de purga a 1 decimal; null/vacío → null. */
export function normalizePurgeGrams(
  value: number | null | undefined,
): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  if (n === 0) return 0;
  return Math.round(n * 10) / 10;
}

export function normalizeColorChanges(
  value: number | null | undefined,
): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.trunc(n);
}

/**
 * Reparte gramos de purga entre filas en proporción a sus gramos.
 * Si el total de gramos es 0, reparte en partes iguales.
 */
export function distributePurgeGrams(
  lines: Array<{ grams: number }>,
  purgeGrams: number,
): number[] {
  const purge = Math.max(0, Number(purgeGrams) || 0);
  if (!lines.length || purge <= 0) {
    return lines.map(() => 0);
  }
  const weights = lines.map((line) => Math.max(0, Number(line.grams) || 0));
  const total = weights.reduce((sum, grams) => sum + grams, 0);
  if (total <= 0) {
    const each = purge / lines.length;
    return lines.map(() => each);
  }
  return weights.map((grams) => (purge * grams) / total);
}

function normalizeOneFdmFilamentLine(item: unknown): FdmFilamentLine | null {
  if (!item || typeof item !== 'object') return null;

  const record = item as Record<string, unknown>;
  const filamentType = record.filamentType as FilamentType | undefined;
  if (!filamentType || !Object.values(FilamentType).includes(filamentType)) {
    return null;
  }

  const grams = Math.max(0, Number(record.grams) || 0);

  const brand =
    typeof record.brand === 'string' && record.brand.trim()
      ? record.brand.trim()
      : undefined;
  const brandId =
    typeof record.brandId === 'string' && record.brandId.trim()
      ? record.brandId.trim()
      : undefined;
  const label =
    typeof record.label === 'string' && record.label.trim()
      ? record.label.trim()
      : undefined;
  const colorId =
    normalizeProductColorId(
      typeof record.colorId === 'string' ? record.colorId : undefined,
    ) ?? INDISTINTO_COLOR_ID;

  return {
    id:
      typeof record.id === 'string' && record.id.trim()
        ? record.id.trim()
        : createFdmFilamentLineId(),
    filamentType,
    grams,
    brand,
    brandId,
    label,
    colorId,
  };
}
