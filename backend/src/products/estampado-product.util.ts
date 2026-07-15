import { PaperType } from '../common/enums';
import {
  EstampadoPressCycle,
  EstampadoPrintSpec,
  EstampadoSupplyLine,
  Impreso,
  ProductEstampado,
} from '../common/interfaces';

export function createEstampadoPrintId(): string {
  return `ep-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createEstampadoPressCycleId(): string {
  return `ec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createEstampadoSupplyLineId(): string {
  return `es-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Segunda dimensión para área de papel: largo si existe, sino alto. */
export function resolvePrintAreaSecondCm(
  lengthCm?: number,
  heightCm?: number,
): number {
  const length = Number(lengthCm) || 0;
  const height = Number(heightCm) || 0;
  return length > 0 ? length : height;
}

export function hasValidPrintSize(
  widthCm?: number,
  lengthCm?: number,
  heightCm?: number,
): boolean {
  const width = Number(widthCm) || 0;
  return width > 0 && resolvePrintAreaSecondCm(lengthCm, heightCm) > 0;
}

export function formatPrintDimensionsCm(
  widthCm: number,
  lengthCm?: number,
  heightCm?: number,
): string {
  const width = Number(widthCm) || 0;
  const length = Number(lengthCm) || 0;
  const height = Number(heightCm) || 0;
  if (width <= 0) {
    return '';
  }
  const parts = [width];
  if (length > 0) {
    parts.push(length);
  }
  if (height > 0) {
    parts.push(height);
  }
  return `${parts.join(' × ')} cm`;
}

export function normalizeEstampadoPrints(
  prints: EstampadoPrintSpec[] | undefined,
  legacy?: {
    paperType?: PaperType;
    impresoId?: string;
    widthCm?: number;
    lengthCm?: number;
    heightCm?: number;
  },
): EstampadoPrintSpec[] {
  if (prints?.length) {
    return prints.map((print) => ({
      id: print.id || createEstampadoPrintId(),
      paperType: print.paperType,
      impresoId: print.impresoId?.trim() || undefined,
      widthCm:
        print.widthCm != null && print.widthCm > 0 ? print.widthCm : undefined,
      lengthCm:
        print.lengthCm != null && print.lengthCm > 0
          ? print.lengthCm
          : undefined,
      heightCm:
        print.heightCm != null && print.heightCm > 0 ? print.heightCm : undefined,
      label: print.label?.trim() || undefined,
    }));
  }

  if (
    legacy?.paperType &&
    (legacy.impresoId ||
      hasValidPrintSize(legacy.widthCm, legacy.lengthCm, legacy.heightCm))
  ) {
    return [
      {
        id: createEstampadoPrintId(),
        paperType: legacy.paperType,
        impresoId: legacy.impresoId,
        widthCm: legacy.widthCm,
        lengthCm: legacy.lengthCm,
        heightCm: legacy.heightCm,
      },
    ];
  }

  return [];
}

export function normalizeEstampadoSupplies(
  supplies: EstampadoSupplyLine[] | undefined,
): EstampadoSupplyLine[] {
  if (!supplies?.length) {
    return [];
  }
  return supplies
    .map((line) => ({
      id: line.id || createEstampadoSupplyLineId(),
      supplyId: line.supplyId?.trim() ?? '',
      quantity: Math.max(Number(line.quantity) || 0, 0),
      label: line.label?.trim() || undefined,
    }))
    .filter((line) => line.supplyId && line.quantity > 0);
}

export function normalizeEstampadoPressCycles(
  cycles: EstampadoPressCycle[] | undefined,
  legacyPressMinutes?: number,
): EstampadoPressCycle[] {
  if (cycles?.length) {
    return cycles.map((cycle) => ({
      id: cycle.id || createEstampadoPressCycleId(),
      pressMinutes: Math.max(Number(cycle.pressMinutes) || 0, 0),
      bajadas: Math.max(Number(cycle.bajadas) || 1, 1),
      label: cycle.label?.trim() || undefined,
    }));
  }

  if (legacyPressMinutes != null && legacyPressMinutes > 0) {
    return [
      {
        id: createEstampadoPressCycleId(),
        pressMinutes: legacyPressMinutes,
        bajadas: 1,
      },
    ];
  }

  return [];
}

export function resolvePrintDimensions(
  print: EstampadoPrintSpec,
  getImpresoById: (id: string) => Impreso | undefined,
): {
  paperType: PaperType;
  widthCm: number;
  lengthCm?: number;
  heightCm: number;
} | null {
  if (print.impresoId) {
    const impreso = getImpresoById(print.impresoId);
    if (!impreso) {
      return null;
    }
    const areaSecond = resolvePrintAreaSecondCm(
      impreso.lengthCm,
      impreso.heightCm,
    );
    if (impreso.widthCm <= 0 || areaSecond <= 0) {
      return null;
    }
    return {
      paperType: impreso.paperType,
      widthCm: impreso.widthCm,
      lengthCm: impreso.lengthCm,
      heightCm: areaSecond,
    };
  }

  const widthCm = Number(print.widthCm) || 0;
  const lengthCm =
    print.lengthCm != null && print.lengthCm > 0 ? print.lengthCm : undefined;
  const heightCm = Number(print.heightCm) || 0;
  const areaSecond = resolvePrintAreaSecondCm(lengthCm, heightCm);
  if (!print.paperType || widthCm <= 0 || areaSecond <= 0) {
    return null;
  }

  return {
    paperType: print.paperType,
    widthCm,
    lengthCm,
    heightCm: areaSecond,
  };
}

export function resolvePrintDisplayDimensions(
  print: EstampadoPrintSpec,
  getImpresoById: (id: string) => Impreso | undefined,
): { widthCm: number; lengthCm?: number; heightCm?: number } | null {
  if (print.impresoId) {
    const impreso = getImpresoById(print.impresoId);
    if (!impreso) {
      return null;
    }
    return {
      widthCm: impreso.widthCm,
      lengthCm: impreso.lengthCm,
      heightCm: impreso.heightCm,
    };
  }

  const widthCm = Number(print.widthCm) || 0;
  const lengthCm =
    print.lengthCm != null && print.lengthCm > 0 ? print.lengthCm : undefined;
  const heightCm =
    print.heightCm != null && print.heightCm > 0 ? print.heightCm : undefined;
  if (!hasValidPrintSize(widthCm, lengthCm, heightCm)) {
    return null;
  }

  return { widthCm, lengthCm, heightCm };
}

export function totalEstampadoPressMinutes(
  cycles: EstampadoPressCycle[] | undefined,
  legacyPressMinutes?: number,
): number {
  const normalized = normalizeEstampadoPressCycles(
    cycles,
    legacyPressMinutes,
  );
  return normalized.reduce(
    (sum, cycle) =>
      sum + (Number(cycle.pressMinutes) || 0) * (Number(cycle.bajadas) || 1),
    0,
  );
}

export function formatEstampadoSizeLabel(
  prints: EstampadoPrintSpec[],
  getImpresoById: (id: string) => Impreso | undefined,
): string {
  return normalizeEstampadoPrints(prints)
    .map((print) => {
      const dims = resolvePrintDisplayDimensions(print, getImpresoById);
      if (!dims) {
        return print.label?.trim() ?? '';
      }
      const sizeLabel = formatPrintDimensionsCm(
        dims.widthCm,
        dims.lengthCm,
        dims.heightCm,
      );
      if (print.impresoId) {
        const impreso = getImpresoById(print.impresoId);
        const base = impreso
          ? `${impreso.name} (${sizeLabel})`
          : sizeLabel;
        return print.label?.trim() ? `${print.label}: ${base}` : base;
      }
      return print.label?.trim() ? `${print.label}: ${sizeLabel}` : sizeLabel;
    })
    .filter(Boolean)
    .join(' · ');
}

export function asEstampadoProduct(product: ProductEstampado): ProductEstampado {
  return {
    ...product,
    prints: normalizeEstampadoPrints(product.prints, {
      paperType: product.paperType,
      impresoId: product.impresoId,
      widthCm: product.widthCm,
      lengthCm: undefined,
      heightCm: product.heightCm,
    }),
    pressCycles: normalizeEstampadoPressCycles(
      product.pressCycles,
      product.pressMinutes,
    ),
    supplies: normalizeEstampadoSupplies(product.supplies),
  };
}
