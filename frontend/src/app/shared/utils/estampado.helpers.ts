import {
  EstampadoPressCycle,
  EstampadoPrintSpec,
  EstampadoSupplyLine,
  ImpresoWithCost,
  INDISTINTO_COLOR_ID,
  PaperType,
} from '../../core/models';
import { normalizeColorId } from './color.helpers';

export function createEstampadoPrintId(): string {
  return `ep-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createEstampadoSupplyLineId(): string {
  return `es-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createEstampadoPressCycleId(): string {
  return `ec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createEmptyEstampadoSupplyLine(): EstampadoSupplyLine {
  return {
    id: createEstampadoSupplyLineId(),
    supplyId: '',
    quantity: 1,
    colorId: INDISTINTO_COLOR_ID,
  };
}

export function createEmptyEstampadoPrint(): EstampadoPrintSpec {
  return {
    id: createEstampadoPrintId(),
    paperType: PaperType.DTF,
    quantity: 1,
  };
}

export function createEmptyEstampadoPressCycle(): EstampadoPressCycle {
  return {
    id: createEstampadoPressCycleId(),
    pressMinutes: 0,
    bajadas: 1,
  };
}

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
    return '—';
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

export function isEstampadoPrintValid(print: EstampadoPrintSpec): boolean {
  return hasValidPrintSize(print.widthCm, print.lengthCm, print.heightCm);
}

export function syncEstampadoPrintFromImpreso(
  print: EstampadoPrintSpec,
  impresos: ImpresoWithCost[],
): EstampadoPrintSpec {
  const impreso = impresos.find((item) => item.id === print.impresoId);
  if (!impreso) {
    return print;
  }
  // La UI de medida usa width × length; el catálogo a veces guarda el 2.º lado en heightCm.
  const secondCm = resolvePrintAreaSecondCm(impreso.lengthCm, impreso.heightCm);
  return {
    ...print,
    paperType: impreso.paperType,
    widthCm: impreso.widthCm,
    lengthCm: secondCm > 0 ? secondCm : undefined,
    heightCm: impreso.heightCm,
  };
}

export function formatEstampadoSizeFromPrints(
  prints: EstampadoPrintSpec[],
  impresos: ImpresoWithCost[],
): string {
  return prints
    .map((print) => {
      const impreso = print.impresoId
        ? impresos.find((item) => item.id === print.impresoId)
        : undefined;
      const widthCm = impreso?.widthCm ?? print.widthCm;
      const lengthCm = impreso?.lengthCm ?? print.lengthCm;
      const heightCm = impreso?.heightCm ?? print.heightCm;
      if (!hasValidPrintSize(widthCm, lengthCm, heightCm)) {
        return print.label?.trim() ?? '';
      }
      const sizeLabel = formatPrintDimensionsCm(
        widthCm!,
        lengthCm,
        heightCm,
      );
      const base = impreso
        ? `${impreso.name} (${sizeLabel})`
        : sizeLabel;
      return print.label?.trim() ? `${print.label}: ${base}` : base;
    })
    .filter(Boolean)
    .join(' · ');
}

export function parseSizeFieldsFromString(size: string): {
  widthCm?: number;
  lengthCm?: number;
  heightCm?: number;
} {
  const numbers =
    size.match(/[\d]+(?:[.,]\d+)?/g)?.map((value) => Number(value.replace(',', '.'))) ??
    [];
  if (!numbers.length) {
    return {};
  }
  if (numbers.length >= 3) {
    return {
      widthCm: numbers[0],
      lengthCm: numbers[1],
      heightCm: numbers[2],
    };
  }
  return {
    widthCm: numbers[0],
    heightCm: numbers[1],
  };
}

export function printUsesCustomSize(print: EstampadoPrintSpec): boolean {
  return !print.impresoId;
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
      quantity: Math.max(1, Math.round(Number(print.quantity) || 1)),
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
        quantity: 1,
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
      colorId: normalizeColorId(line.colorId),
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

export function printQuantity(print: Pick<EstampadoPrintSpec, 'quantity'>): number {
  return Math.max(1, Math.round(Number(print.quantity) || 1));
}

/** Agrupa impresos por tipo de papel + medida y suma cantidades. */
export function summarizeEstampadoPrintQuantities(
  prints: EstampadoPrintSpec[] | undefined,
  getImpresoById?: (id: string) => ImpresoWithCost | undefined,
): Array<{
  paperType: PaperType;
  widthCm: number;
  heightCm: number;
  quantity: number;
}> {
  const groups = new Map<
    string,
    { paperType: PaperType; widthCm: number; heightCm: number; quantity: number }
  >();

  for (const print of normalizeEstampadoPrints(prints)) {
    const dims = resolvePrintDimensions(print, getImpresoById ?? (() => undefined));
    if (!dims) continue;
    const key = `${dims.paperType}|${dims.widthCm}|${dims.heightCm}`;
    const existing = groups.get(key);
    const qty = printQuantity(print);
    if (existing) {
      existing.quantity += qty;
    } else {
      groups.set(key, {
        paperType: dims.paperType,
        widthCm: dims.widthCm,
        heightCm: dims.heightCm,
        quantity: qty,
      });
    }
  }

  return [...groups.values()];
}

export function resolvePrintDimensions(
  print: EstampadoPrintSpec,
  getImpresoById: (id: string) => ImpresoWithCost | undefined,
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
