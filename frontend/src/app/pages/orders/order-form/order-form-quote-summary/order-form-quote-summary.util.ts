import { OrderLineDraft, ServiceType } from '../../../../core/models';
import { SERVICE_TYPE_LABELS } from '../../../../shared/constants/labels';
import { isLineBlank } from '../../../../shared/utils/order.helpers';

export interface QuoteResumenItem {
  key: string;
  serviceType: ServiceType;
  label: string;
  total: number;
}

export interface QuoteAreaShare {
  serviceType: ServiceType;
  label: string;
  percent: number;
}

const AREA_SHORT_LABELS: Record<ServiceType, string> = {
  [ServiceType.IMPRESION_3D]: '3D',
  [ServiceType.DISENO_GRAFICO]: 'Diseño',
  [ServiceType.MODELADO]: 'Modelado',
  [ServiceType.ESTAMPADO]: 'Estampado',
};

export function buildQuoteResumenItems(
  lines: OrderLineDraft[],
  titleFor: (line: OrderLineDraft, index: number) => string,
  totalFor: (line: OrderLineDraft) => number,
): QuoteResumenItem[] {
  // Incluye líneas con precio 0/negativo para no desaparecerlas del resumen.
  return lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => !isLineBlank(line))
    .map(({ line, index }) => {
      const qty = Number(line.quantity);
      const qtyLabel = Number.isFinite(qty) ? qty : line.quantity;
      return {
        key: `${index}-${line.serviceType}-${line.productId || 'custom'}`,
        serviceType: line.serviceType,
        label: `${titleFor(line, index)} · ${qtyLabel} u`,
        total: totalFor(line),
      };
    });
}

export function buildQuoteAreaShares(
  lines: OrderLineDraft[],
  subtotal: number,
  totalFor: (line: OrderLineDraft) => number,
): QuoteAreaShare[] {
  if (subtotal <= 0) return [];
  const totals = new Map<ServiceType, number>();
  for (const line of lines) {
    totals.set(line.serviceType, (totals.get(line.serviceType) ?? 0) + totalFor(line));
  }
  return [...totals.entries()]
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([serviceType, value]) => ({
      serviceType,
      label: AREA_SHORT_LABELS[serviceType],
      percent: Math.round((value / subtotal) * 100),
    }));
}

export function buildQuoteResumenWarnings(
  missingRateLabels: string[],
  suppliesWithoutPrice: string[],
): string[] {
  const warnings: string[] = [];
  if (missingRateLabels.length > 1) {
    warnings.push(
      'Diseño y modelado salen en costo porque sus tarifas por hora están en $ 0. La seña y el área siguen contando.',
    );
  } else if (missingRateLabels.length === 1) {
    const label =
      missingRateLabels[0] === SERVICE_TYPE_LABELS[ServiceType.DISENO_GRAFICO]
        ? 'Diseño'
        : missingRateLabels[0] === SERVICE_TYPE_LABELS[ServiceType.MODELADO]
          ? 'Modelado'
          : missingRateLabels[0];
    warnings.push(
      `${label} sale en costo porque la tarifa por hora está en $ 0. La seña y el área siguen contando.`,
    );
  }
  for (const name of suppliesWithoutPrice) {
    warnings.push(`${name} no tiene precio en Insumos: el costo no lo incluye.`);
  }
  return warnings;
}
