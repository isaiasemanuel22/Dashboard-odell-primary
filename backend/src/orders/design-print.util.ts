import { PaperType } from '../common/enums';
import { OrderItem } from '../common/interfaces';

export function hasValidDesignPrintSize(item: Pick<OrderItem, 'printWidthCm' | 'printLengthCm'>): boolean {
  const width = Number(item.printWidthCm) || 0;
  const length = Number(item.printLengthCm) || 0;
  return width > 0 && length > 0;
}

export function isDesignPrintConfigured(
  item: Pick<
    OrderItem,
    'includesPrint' | 'printPaperType' | 'printWidthCm' | 'printLengthCm'
  >,
): boolean {
  return (
    !!item.includesPrint &&
    !!item.printPaperType &&
    hasValidDesignPrintSize(item)
  );
}

export function designPrintMachineLabel(paperType?: PaperType): string {
  switch (paperType) {
    case PaperType.SUBLIMACION:
      return 'Impresión sublimación';
    case PaperType.DTF_UV:
      return 'Impresión DTF UV';
    case PaperType.DTF:
      return 'Impresión DTF';
    default:
      return 'Impresión';
  }
}

export function designPrintTaskName(item: OrderItem): string {
  const qty = item.productionRequiredQuantity ?? item.quantity;
  const dims =
    item.printWidthCm && item.printLengthCm
      ? ` (${item.printWidthCm}×${item.printLengthCm} cm)`
      : '';
  return `Imprimir ${qty}× ${item.productName}${dims}`;
}

export function formatDesignPrintDimensions(item: OrderItem): string {
  if (!hasValidDesignPrintSize(item)) return '';
  return `${item.printWidthCm}×${item.printLengthCm} cm`;
}
