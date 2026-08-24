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

export function hasValidFdmFilamentInput(filaments: FdmFilamentLine[]): boolean {
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
}): FdmFilamentLine[] {
  return normalizeFdmFilaments(input.filaments, {
    grams: input.grams,
    filamentType: input.filamentType,
    brand: input.brand,
  });
}

export function storedFdmFilaments(filaments: FdmFilamentLine[]): FdmFilamentLine[] {
  return filaments.filter((line) => Number(line.grams) > 0);
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
    label,
    colorId,
  };
}
