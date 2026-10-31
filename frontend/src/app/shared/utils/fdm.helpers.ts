import { FdmFilamentLine, FilamentType, INDISTINTO_COLOR_ID } from '../../core/models';
import { FILAMENT_TYPE_LABELS } from '../constants/labels';
import { normalizeColorId } from './color.helpers';

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
  raw: FdmFilamentLine[] | undefined,
  legacy?: {
    grams?: number;
    filamentType?: FilamentType;
    brand?: string;
    colorId?: string;
  },
): FdmFilamentLine[] {
  if (raw?.length) {
    return raw.map((line) => ({
      id: line.id || createFdmFilamentLineId(),
      filamentType: line.filamentType,
      grams: Math.max(0, Number(line.grams) || 0),
      brand: line.brand?.trim() || undefined,
      label: line.label?.trim() || undefined,
      colorId: normalizeColorId(line.colorId),
    }));
  }

  const grams = Number(legacy?.grams) || 0;
  if (grams > 0 && legacy?.filamentType) {
    return [
      {
        id: createFdmFilamentLineId(),
        filamentType: legacy.filamentType,
        grams,
        brand: legacy.brand?.trim() || undefined,
        colorId: normalizeColorId(legacy.colorId),
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
  return filaments.some((line) => Number(line.grams) > 0 && line.filamentType);
}

export function storedFdmFilaments(filaments: FdmFilamentLine[]): FdmFilamentLine[] {
  return normalizeFdmFilaments(
    filaments.filter((line) => Number(line.grams) > 0),
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

/** Resumen para detalle: "PLA 30 g + PETG 20 g". */
export function formatFdmFilamentsSummary(input: {
  filaments?: FdmFilamentLine[];
  grams?: number;
  filamentType?: FilamentType | string | null;
}): string {
  const rows = normalizeFdmFilaments(input.filaments, {
    grams: input.grams,
    filamentType: input.filamentType as FilamentType | undefined,
  }).filter((row) => (Number(row.grams) || 0) > 0 && row.filamentType);

  if (!rows.length) {
    // Resina: el campo grams guarda ml.
    const ml = Math.round(Number(input.grams) || 0);
    return ml > 0 ? `Resina ${ml} ml` : '';
  }

  return rows
    .map((row) => {
      const type =
        FILAMENT_TYPE_LABELS[row.filamentType] ??
        String(row.filamentType).toUpperCase();
      const grams = Math.round(Number(row.grams) || 0);
      return `${type} ${grams} g`;
    })
    .join(' + ');
}
