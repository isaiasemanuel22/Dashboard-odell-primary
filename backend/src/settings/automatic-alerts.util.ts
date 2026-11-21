import { AutomaticAlertsSettings } from '../common/interfaces';

/** Los tres avisos arrancan prendidos (§28.5). */
export const DEFAULT_AUTOMATIC_ALERTS: AutomaticAlertsSettings = {
  ordersDue: true,
  lowStock: true,
  weeklyReceivables: true,
};

/** Asegura forma y valores válidos al cargar o guardar los avisos. */
export function normalizeAutomaticAlerts(
  raw: unknown,
): AutomaticAlertsSettings {
  const source =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const read = (key: keyof AutomaticAlertsSettings): boolean =>
    typeof source[key] === 'boolean'
      ? source[key]
      : DEFAULT_AUTOMATIC_ALERTS[key];
  return {
    ordersDue: read('ordersDue'),
    lowStock: read('lowStock'),
    weeklyReceivables: read('weeklyReceivables'),
  };
}
