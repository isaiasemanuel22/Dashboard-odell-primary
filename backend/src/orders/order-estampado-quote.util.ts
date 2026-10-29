import { ProductType, ServiceType } from '../common/enums';
import {
  EstampadoPressCycle,
  EstampadoPrintSpec,
  EstampadoSupplyLine,
  OrderItem,
} from '../common/interfaces';
import {
  hasValidPrintSize,
  normalizeEstampadoPressCycles,
  normalizeEstampadoPrints,
  normalizeEstampadoSupplies,
} from '../products/estampado-product.util';

export function isCustomEstampadoOrderLine(
  item: Pick<OrderItem, 'serviceType' | 'productId'>,
): boolean {
  return item.serviceType === ServiceType.ESTAMPADO && !item.productId;
}

export function isEstampadoQuoteConfigured(
  item: Pick<
    OrderItem,
    'estampadoPrints' | 'estampadoPressCycles' | 'estampadoSupplies'
  >,
): boolean {
  const prints = normalizeEstampadoPrints(item.estampadoPrints);
  const supplies = normalizeEstampadoSupplies(item.estampadoSupplies);
  const cycles = normalizeEstampadoPressCycles(item.estampadoPressCycles);

  const hasPrints = prints.some(
    (print) =>
      !!print.paperType &&
      hasValidPrintSize(print.widthCm, print.lengthCm, print.heightCm),
  );
  const hasSupplies = supplies.some(
    (line) => line.supplyId && Number(line.quantity) > 0,
  );
  const hasPress = cycles.some(
    (cycle) => Number(cycle.pressMinutes) > 0 && Number(cycle.bajadas) >= 1,
  );

  return hasPrints || hasSupplies || hasPress;
}

export function buildEstampadoCostInput(
  item: Pick<
    OrderItem,
    'estampadoPrints' | 'estampadoPressCycles' | 'estampadoSupplies'
  >,
) {
  return {
    type: ProductType.ESTAMPADO as const,
    workTimeHours: 0,
    estampadoPrints: normalizeEstampadoPrints(
      item.estampadoPrints,
    ) as EstampadoPrintSpec[],
    estampadoPressCycles: normalizeEstampadoPressCycles(
      item.estampadoPressCycles,
    ) as EstampadoPressCycle[],
    estampadoSupplies: normalizeEstampadoSupplies(
      item.estampadoSupplies,
    ) as EstampadoSupplyLine[],
  };
}
