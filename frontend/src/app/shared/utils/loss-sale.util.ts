import { ServiceType } from '../../core/models';
import { calculateLinePriceTotal } from './order.helpers';
import { isDesignService, isThirdPartyService } from './service-type.util';

export interface LossSaleItemInput {
  serviceType?: ServiceType;
  productName: string;
  quantity: number;
  unitPrice: number;
  /** Costo unitario cargado (snapshot de la línea). */
  unitCost?: number;
  designUnitPrice?: number;
  includesPrint?: boolean;
}

export interface LossSaleLine {
  index: number;
  productName: string;
  /** Precio efectivo por unidad (en diseño, el importe de la línea ÷ cantidad). */
  unitPrice: number;
  unitCost: number;
  /** Lo que pierde la línea completa (costo − precio). */
  loss: number;
}

export interface LossSaleResult {
  isLoss: boolean;
  lines: LossSaleLine[];
  /** Ganancia total (total − costo − terceros prorrateados). */
  profit: number;
  profitNegative: boolean;
}

/**
 * Detecta venta a pérdida: alguna línea con precio < costo, o ganancia total
 * negativa. Misma lógica que backend/src/common/utils/loss-sale.util.ts.
 */
export function detectLossSale(
  items: LossSaleItemInput[],
  total: number,
): LossSaleResult {
  const lines: LossSaleLine[] = [];
  let cost = 0;
  let linesTotal = 0;
  let thirdParty = 0;

  items.forEach((item, index) => {
    const quantity = Math.max(Math.trunc(Number(item.quantity) || 0), 0);
    const serviceType = item.serviceType;
    const revenue = calculateLinePriceTotal({
      serviceType: serviceType as ServiceType,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      designUnitPrice: item.designUnitPrice,
      includesPrint: item.includesPrint,
    });
    linesTotal += revenue;

    if (serviceType && isThirdPartyService(serviceType)) {
      thirdParty += revenue;
      return;
    }
    const unitCost = Math.max(Number(item.unitCost) || 0, 0);
    const lineCost = unitCost * (Number(item.quantity) || 0);
    cost += lineCost;
    if (quantity <= 0) return;

    // Diseño/modelado: el precio es cerrado, se compara el importe de la línea.
    const isDesign = !!serviceType && isDesignService(serviceType);
    const effective = isDesign ? revenue / quantity : Number(item.unitPrice) || 0;
    const comparedRevenue = isDesign ? revenue : effective * quantity;
    if (comparedRevenue < lineCost - 0.5) {
      lines.push({
        index,
        productName: item.productName,
        unitPrice: Math.round(effective),
        unitCost: Math.round(unitCost),
        loss: Math.round(lineCost - comparedRevenue),
      });
    }
  });

  const chargedThird =
    linesTotal > 0 ? Math.round(thirdParty * (total / linesTotal)) : 0;
  const profit = Math.round(total - cost - chargedThird);
  const profitNegative = profit < 0;

  return {
    isLoss: lines.length > 0 || profitNegative,
    lines,
    profit,
    profitNegative,
  };
}

/** Clave estable del set de líneas en pérdida (para saber si cambió). */
export function lossSaleSignature(result: LossSaleResult): string {
  return `${result.lines.map((l) => l.index).join(',')}|${result.profitNegative ? 1 : 0}`;
}
