import type { PrintJobFailure } from '../../core/models';

/** Motivo canónico de bloqueo automático por insumos (§12.2). */
export const BLOCKED_REASON_SUPPLIES = 'Insumos insuficientes';

export const FAILURE_REASONS = [
  'despegue',
  'enredo',
  'corte_luz',
  'atasco',
  'otro',
] as const satisfies ReadonlyArray<PrintJobFailure['reason']>;

export const FAILURE_REASON_LABELS: Record<PrintJobFailure['reason'], string> = {
  despegue: 'Se despegó de la cama',
  enredo: 'Enredo de filamento',
  corte_luz: 'Corte de luz',
  atasco: 'Atasco de boquilla',
  otro: 'Otro',
};
