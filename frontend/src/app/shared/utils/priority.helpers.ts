/** Clase CSS según nivel de prioridad (0 = baja, 3+ = alta). */
export function priorityTierClass(priority: number): string {
  if (priority >= 3) return 'priority-high';
  if (priority === 2) return 'priority-medium';
  if (priority === 1) return 'priority-normal';
  return 'priority-low';
}

export const PRIORITY_TIER_LABELS: Record<string, string> = {
  'priority-high': 'Alta',
  'priority-medium': 'Media',
  'priority-normal': 'Normal',
  'priority-low': 'Baja',
};
