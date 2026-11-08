/** Motivo de bloqueo automático por falta de insumos (único string canónico). */
export const BLOCKED_REASON_SUPPLIES = 'Insumos insuficientes';

export const FAILURE_REASONS = [
  'despegue',
  'enredo',
  'corte_luz',
  'atasco',
  'otro',
] as const;

export type FailureReason = (typeof FAILURE_REASONS)[number];

export const FAILURE_REASON_LABELS: Record<FailureReason, string> = {
  despegue: 'Se despegó de la cama',
  enredo: 'Enredo de filamento',
  corte_luz: 'Corte de luz',
  atasco: 'Atasco de boquilla',
  otro: 'Otro',
};

export interface PrintJobFailureEntry {
  id: string;
  at: string;
  userId?: string;
  pieces: number;
  grams: number;
  hours: number;
  reason: FailureReason;
  cost: number;
}

export function parseFailures(
  raw?: string | PrintJobFailureEntry[] | null,
): PrintJobFailureEntry[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw) as PrintJobFailureEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function serializeFailures(
  entries: PrintJobFailureEntry[],
): string | null {
  return entries.length ? JSON.stringify(entries) : null;
}
