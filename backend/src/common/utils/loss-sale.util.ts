import { BadRequestException } from '@nestjs/common';
import { ServiceType } from '../enums';
import { isDesignService } from '../service-type.util';
import { calculateOrderLineSubtotal } from '../../orders/order-pricing.util';
import {
  LOSS_REASON_CODES,
  LOSS_REASON_NOTE_MAX,
  LOSS_REASON_REQUIRED_MESSAGE,
} from '../loss-reason';

export interface LossSaleItemInput {
  serviceType?: ServiceType;
  productName: string;
  quantity: number;
  unitPrice: number;
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
  /** Ganancia total (total − costo; el servicio de un tercero cuenta su costo, §16.3). */
  profit: number;
  profitNegative: boolean;
}

/**
 * Detecta venta a pérdida: alguna línea con precio < costo, o ganancia total
 * negativa. Mismo cálculo que quoteEstimatedProfit / SalesService.
 * `resolveUnitCost` devuelve el costo unitario de la línea.
 */
export function detectLossSale<T extends LossSaleItemInput>(
  items: T[],
  total: number,
  resolveUnitCost: (item: T) => number,
): LossSaleResult {
  const lines: LossSaleLine[] = [];
  let cost = 0;

  items.forEach((item, index) => {
    const quantity = Math.max(Math.trunc(Number(item.quantity) || 0), 0);
    const revenue = calculateOrderLineSubtotal(item);
    const unitCost = Math.max(Number(resolveUnitCost(item)) || 0, 0);
    const lineCost = unitCost * (Number(item.quantity) || 0);
    cost += lineCost;
    if (quantity <= 0) return;

    // Diseño/modelado: el precio es cerrado, se compara el importe de la línea.
    const isDesign = item.serviceType && isDesignService(item.serviceType);
    const effective = isDesign
      ? revenue / quantity
      : Number(item.unitPrice) || 0;
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

  const profit = Math.round(total - cost);
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

export interface LossReasonFields {
  lossReason?: string | null;
  lossReasonNote?: string | null;
}

/**
 * Valida y normaliza el motivo según el resultado de la detección.
 * Sin pérdida → motivo vacío. Con pérdida y sin motivo → error.
 * `allowMissing`: copia lo que haya sin bloquear (presupuesto aceptado por estado).
 */
export function resolveLossReason(
  result: LossSaleResult,
  fields: LossReasonFields,
  options: { allowMissing?: boolean } = {},
): { lossReason?: string; lossReasonNote?: string } {
  if (!result.isLoss) return {};
  const code = fields.lossReason?.trim();
  if (!code) {
    if (options.allowMissing) return {};
    return throwMissing();
  }
  if (!LOSS_REASON_CODES.includes(code)) return throwMissing();
  const note =
    fields.lossReasonNote?.trim().slice(0, LOSS_REASON_NOTE_MAX) || undefined;
  if (code === 'otro' && !note && !options.allowMissing) {
    throw new BadRequestException('Contanos el motivo en la nota');
  }
  return { lossReason: code, lossReasonNote: note };
}

function throwMissing(): never {
  throw new BadRequestException(LOSS_REASON_REQUIRED_MESSAGE);
}
