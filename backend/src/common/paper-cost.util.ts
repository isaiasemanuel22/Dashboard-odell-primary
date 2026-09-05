import { PaperType } from './enums';
import { PaperReferenceSheet, PaperReferenceSheets } from './interfaces';

export const DEFAULT_PAPER_REFERENCE_SHEET_CM = {
  widthCm: 60,
  lengthCm: 100,
} as const;

export function calculatePaperCostFromPricePerSqm(
  pricePerSqm: number,
  widthCm: number,
  lengthCm: number,
): number {
  const width = Number(widthCm) || 0;
  const length = Number(lengthCm) || 0;
  const price = Number(pricePerSqm) || 0;
  if (width <= 0 || length <= 0 || price <= 0) {
    return 0;
  }

  return Math.round((width * length) / 10000 * price);
}

export function calculatePaperCostFromReferenceSheet(
  sheet: PaperReferenceSheet,
  widthCm: number,
  lengthCm: number,
): number {
  const sheetAreaCm2 = sheet.widthCm * sheet.lengthCm;
  const printWidth = Number(widthCm) || 0;
  const printLength = Number(lengthCm) || 0;
  if (sheetAreaCm2 <= 0 || printWidth <= 0 || printLength <= 0) {
    return 0;
  }

  const printAreaCm2 = printWidth * printLength;
  const pricePerCm2 = sheet.price / sheetAreaCm2;
  return Math.round(printAreaCm2 * pricePerCm2);
}

/** Usa el $/m² guardado en configuración (fuente de verdad para costos). */
export function calculatePaperCostFromSettings(
  pricePerSqm: number,
  widthCm: number,
  lengthCm: number,
): number {
  return calculatePaperCostFromPricePerSqm(pricePerSqm, widthCm, lengthCm);
}

export function pricePerSqmFromReferenceSheet(
  sheet: PaperReferenceSheet,
): number {
  const areaSqm = (sheet.widthCm * sheet.lengthCm) / 10000;
  if (areaSqm <= 0) return 0;
  return Math.round(sheet.price / areaSqm);
}

export function referenceSheetFromPricePerSqm(
  pricePerSqm: number,
  widthCm: number = DEFAULT_PAPER_REFERENCE_SHEET_CM.widthCm,
  lengthCm: number = DEFAULT_PAPER_REFERENCE_SHEET_CM.lengthCm,
): PaperReferenceSheet {
  const areaSqm = (widthCm * lengthCm) / 10000;
  return {
    widthCm,
    lengthCm,
    price: Math.round(Math.max(pricePerSqm, 0) * areaSqm),
  };
}

export function paperReferenceKey(
  paperType: PaperType,
): keyof PaperReferenceSheets {
  switch (paperType) {
    case PaperType.SUBLIMACION:
      return 'sublimacion';
    case PaperType.DTF:
      return 'dtf';
    case PaperType.DTF_UV:
      return 'dtfUv';
    default:
      return 'dtf';
  }
}

export function normalizePaperReferenceSheets(
  raw: Partial<PaperReferenceSheets> | undefined,
  paperPricesPerSqm: {
    sublimacion: number;
    dtf: number;
    dtfUv: number;
  },
): PaperReferenceSheets {
  const fallback = {
    sublimacion: referenceSheetFromPricePerSqm(paperPricesPerSqm.sublimacion),
    dtf: referenceSheetFromPricePerSqm(paperPricesPerSqm.dtf),
    dtfUv: referenceSheetFromPricePerSqm(paperPricesPerSqm.dtfUv),
  };

  return {
    sublimacion: normalizePaperReferenceSheet(raw?.sublimacion, fallback.sublimacion),
    dtf: normalizePaperReferenceSheet(raw?.dtf, fallback.dtf),
    dtfUv: normalizePaperReferenceSheet(raw?.dtfUv, fallback.dtfUv),
  };
}

function normalizePaperReferenceSheet(
  raw: Partial<PaperReferenceSheet> | undefined,
  fallback: PaperReferenceSheet,
): PaperReferenceSheet {
  if (!raw) return fallback;

  const widthCm = Number(raw.widthCm) || fallback.widthCm;
  const lengthCm = Number(raw.lengthCm) || fallback.lengthCm;
  const price =
    raw.price != null && Number.isFinite(Number(raw.price))
      ? Number(raw.price)
      : fallback.price;

  return { widthCm, lengthCm, price };
}

export function syncPaperPricesFromReferenceSheets(
  sheets: PaperReferenceSheets,
): { sublimacion: number; dtf: number; dtfUv: number } {
  return {
    sublimacion: pricePerSqmFromReferenceSheet(sheets.sublimacion),
    dtf: pricePerSqmFromReferenceSheet(sheets.dtf),
    dtfUv: pricePerSqmFromReferenceSheet(sheets.dtfUv),
  };
}
