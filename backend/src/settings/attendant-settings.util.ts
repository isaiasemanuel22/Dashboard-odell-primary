import { AttendantSettings } from '../common/interfaces';

/** Arranca apagado; Isaías lo prende en Ajustes (§28.3). */
export const DEFAULT_ATTENDANT: AttendantSettings = {
  enabled: false,
  stockDeliveryDays: 1,
  deliveryMarginDays: 2,
  monthlyBudgetUsd: 20,
  pausedByBudgetAt: null,
};

/** Asegura forma y valores válidos al cargar o guardar el agente de atención. */
export function normalizeAttendant(raw: unknown): AttendantSettings {
  const source =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const days = (key: 'stockDeliveryDays' | 'deliveryMarginDays'): number => {
    const value = source[key];
    return typeof value === 'number' && Number.isInteger(value) && value >= 0
      ? Math.min(value, 30)
      : DEFAULT_ATTENDANT[key];
  };
  const budget = source.monthlyBudgetUsd;
  return {
    enabled:
      typeof source.enabled === 'boolean'
        ? source.enabled
        : DEFAULT_ATTENDANT.enabled,
    stockDeliveryDays: days('stockDeliveryDays'),
    deliveryMarginDays: days('deliveryMarginDays'),
    monthlyBudgetUsd:
      typeof budget === 'number' && budget > 0
        ? budget
        : DEFAULT_ATTENDANT.monthlyBudgetUsd,
    pausedByBudgetAt:
      typeof source.pausedByBudgetAt === 'string'
        ? source.pausedByBudgetAt
        : null,
  };
}
