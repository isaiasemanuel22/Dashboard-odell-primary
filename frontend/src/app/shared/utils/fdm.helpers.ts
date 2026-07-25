import { FdmFilamentLine, FilamentType } from '../../core/models';

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
  };
}

export function normalizeFdmFilaments(
  raw: FdmFilamentLine[] | undefined,
  legacy?: {
    grams?: number;
    filamentType?: FilamentType;
    brand?: string;
  },
): FdmFilamentLine[] {
  if (raw?.length) {
    return raw.map((line) => ({
      id: line.id || createFdmFilamentLineId(),
      filamentType: line.filamentType,
      grams: Math.max(0, Number(line.grams) || 0),
      brand: line.brand?.trim() || undefined,
      label: line.label?.trim() || undefined,
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
  return filaments.filter((line) => Number(line.grams) > 0);
}
