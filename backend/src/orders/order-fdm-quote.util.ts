import { FilamentType, ProductType, ServiceType } from '../common/enums';
import { OrderItem } from '../common/interfaces';

export function isFdmQuoteConfigured(
  item: Pick<OrderItem, 'grams' | 'printTimeHours' | 'filamentType'>,
): boolean {
  if (!item.filamentType) return false;
  const grams = Number(item.grams) || 0;
  const printTimeHours = Number(item.printTimeHours) || 0;
  return grams > 0 || printTimeHours > 0;
}

export function isCustomFdmOrderLine(item: Pick<OrderItem, 'serviceType' | 'productId'>): boolean {
  return item.serviceType === ServiceType.IMPRESION_3D && !item.productId;
}

export function buildFdmCostInput(
  item: Pick<OrderItem, 'grams' | 'printTimeHours' | 'filamentType'>,
) {
  return {
    type: ProductType.FDM as const,
    grams: Number(item.grams) || 0,
    printTimeHours: Number(item.printTimeHours) || 0,
    workTimeHours: 0,
    filamentType: item.filamentType as FilamentType,
  };
}
