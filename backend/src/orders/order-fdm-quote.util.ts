import {
  FilamentType,
  ProductType,
  ResinType,
  ServiceType,
} from '../common/enums';
import { OrderItem } from '../common/interfaces';

export type PrintProcess = 'fdm' | 'resina';

export function isFdmQuoteConfigured(
  item: Pick<OrderItem, 'grams' | 'printTimeHours' | 'filamentType' | 'filaments'>,
): boolean {
  const printTimeHours = Number(item.printTimeHours) || 0;
  if (item.filaments?.length) {
    const grams = item.filaments.reduce(
      (sum, line) => sum + (Number(line.grams) || 0),
      0,
    );
    const hasType = item.filaments.some((line) => !!line.filamentType);
    return hasType && (grams > 0 || printTimeHours > 0);
  }
  if (!item.filamentType) return false;
  const grams = Number(item.grams) || 0;
  return grams > 0 || printTimeHours > 0;
}

export function isResinQuoteConfigured(
  item: Pick<OrderItem, 'grams' | 'printTimeHours' | 'resinType' | 'printProcess'>,
): boolean {
  if (item.printProcess === 'fdm') return false;
  if (item.printProcess !== 'resina' && !item.resinType) return false;
  if (!item.resinType) return false;
  const grams = Number(item.grams) || 0;
  const printTimeHours = Number(item.printTimeHours) || 0;
  return grams > 0 || printTimeHours > 0;
}

export function isCustomFdmOrderLine(
  item: Pick<OrderItem, 'serviceType' | 'productId'>,
): boolean {
  return item.serviceType === ServiceType.IMPRESION_3D && !item.productId;
}

export function isManualResinOrderLine(
  item: Pick<OrderItem, 'serviceType' | 'productId' | 'printProcess' | 'resinType'>,
): boolean {
  return (
    isCustomFdmOrderLine(item) &&
    (item.printProcess === 'resina' || !!item.resinType)
  );
}

export function normalizePrintProcess(
  value: string | undefined | null,
): PrintProcess | undefined {
  if (value === 'fdm' || value === 'resina') return value;
  return undefined;
}

export function buildFdmCostInput(
  item: Pick<OrderItem, 'grams' | 'printTimeHours' | 'filamentType' | 'workTimeHours'>,
) {
  return {
    type: ProductType.FDM as const,
    grams: Number(item.grams) || 0,
    printTimeHours: Number(item.printTimeHours) || 0,
    workTimeHours: Number(item.workTimeHours) || 0,
    filamentType: item.filamentType as FilamentType,
  };
}

export function buildResinCostInput(
  item: Pick<
    OrderItem,
    | 'grams'
    | 'printTimeHours'
    | 'workTimeHours'
    | 'resinType'
    | 'washMinutes'
    | 'cureMinutes'
  >,
) {
  return {
    type: ProductType.RESINA as const,
    grams: Number(item.grams) || 0,
    printTimeHours: Number(item.printTimeHours) || 0,
    workTimeHours: Number(item.workTimeHours) || 0,
    resinType: item.resinType as ResinType,
    washMinutes: Number(item.washMinutes) || 0,
    cureMinutes: Number(item.cureMinutes) || 0,
  };
}
