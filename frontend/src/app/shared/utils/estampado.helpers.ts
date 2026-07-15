import {
  EstampadoPressCycle,
  EstampadoPrintSpec,
  EstampadoSupplyLine,
  ImpresoWithCost,
  PaperType,
} from '../../core/models';

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
  };
}

export function createEmptyEstampadoPrint(): EstampadoPrintSpec {
  return {
    id: createEstampadoPrintId(),
    paperType: PaperType.DTF,
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
  return {
    ...print,
    paperType: impreso.paperType,
    widthCm: impreso.widthCm,
    lengthCm: impreso.lengthCm,
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
