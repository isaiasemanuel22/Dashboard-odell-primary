import {
  GeneralSettings,
  ImpresoWithCost,
  OrderItem,
  OrderLineDraft,
  PaperType,
} from '../../core/models';
import {
  calculatePaperCostFromPricePerSqm,
  paperReferenceKey,
} from './paper-cost.util';
import {
  hasValidPrintSize,
  syncEstampadoPrintFromImpreso,
} from './estampado.helpers';

export function hasValidDesignPrintSize(
  line: Pick<OrderLineDraft, 'printWidthCm' | 'printLengthCm'>,
): boolean {
  return hasValidPrintSize(line.printWidthCm, line.printLengthCm);
}

export function isDesignPrintConfigured(
  line: Pick<
    OrderLineDraft,
    'includesPrint' | 'printPaperType' | 'printWidthCm' | 'printLengthCm'
  >,
): boolean {
  return (
    !!line.includesPrint &&
    !!line.printPaperType &&
    hasValidDesignPrintSize(line)
  );
}

export function calculateDesignPrintPaperCost(
  settings: Pick<GeneralSettings, 'paperPricesPerSqm'>,
  line: Pick<OrderLineDraft, 'printPaperType' | 'printWidthCm' | 'printLengthCm'>,
): number {
  if (!line.printPaperType || !hasValidDesignPrintSize(line)) {
    return 0;
  }

  const pricePerSqm =
    settings.paperPricesPerSqm[paperReferenceKey(line.printPaperType)];
  return calculatePaperCostFromPricePerSqm(
    pricePerSqm,
    Number(line.printWidthCm) || 0,
    Number(line.printLengthCm) || 0,
  );
}

export function resolveLinePrintUnitPrice(
  line: Pick<
    OrderLineDraft | OrderItem,
    'unitPrice' | 'designUnitPrice' | 'includesPrint'
  > &
    Partial<Pick<OrderLineDraft, 'printUnitPrice'>>,
): number {
  if (!line.includesPrint) return 0;
  if ('printUnitPrice' in line && line.printUnitPrice != null) {
    return Number(line.printUnitPrice) || 0;
  }

  const unitPrice = Number(line.unitPrice) || 0;
  const designUnitPrice =
    line.designUnitPrice != null ? Number(line.designUnitPrice) : null;

  if (designUnitPrice != null && unitPrice > designUnitPrice) {
    return unitPrice - designUnitPrice;
  }

  return unitPrice;
}

export function calculateDesignLineSubtotal(
  line: Pick<
    OrderLineDraft,
    | 'quantity'
    | 'unitPrice'
    | 'designUnitPrice'
    | 'includesPrint'
    | 'printUnitPrice'
  >,
): number {
  const quantity = Math.max(Math.trunc(Number(line.quantity) || 0), 0);
  const designPrice = Number(line.designUnitPrice ?? line.unitPrice) || 0;

  if (!line.includesPrint) {
    return designPrice;
  }

  const printUnitPrice = resolveLinePrintUnitPrice(line);
  return designPrice + quantity * printUnitPrice;
}

export function syncDesignPrintPricing(
  line: OrderLineDraft,
  settings: GeneralSettings,
): void {
  if (!line.includesPrint) {
    line.printUnitCost = undefined;
    line.printUnitPrice = undefined;
    line.unitPrice = line.designUnitPrice ?? line.unitPrice;
    return;
  }

  line.printUnitCost = calculateDesignPrintPaperCost(settings, line);
  line.printUnitPrice = line.printUnitCost;
  line.unitPrice = line.printUnitPrice;
}

export function applyImpresoToDesignLine(
  line: OrderLineDraft,
  impresos: ImpresoWithCost[],
): void {
  if (!line.printImpresoId) return;

  const synced = syncEstampadoPrintFromImpreso(
    {
      id: line.printImpresoId,
      paperType: line.printPaperType ?? PaperType.DTF,
      impresoId: line.printImpresoId,
      widthCm: line.printWidthCm,
      lengthCm: line.printLengthCm,
    },
    impresos,
  );

  line.printPaperType = synced.paperType;
  line.printWidthCm = synced.widthCm;
  line.printLengthCm = synced.lengthCm ?? synced.heightCm;
}
