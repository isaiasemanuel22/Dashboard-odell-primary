/** Motivos para vender a pérdida (BUSINESS-RULES §16). Mantener igual que el backend. */
export const LOSS_REASONS = [
  {
    code: 'liquidacion',
    label: 'Liquidación de stock o producto discontinuado',
  },
  { code: 'falla', label: 'Producto con falla o segunda selección' },
  { code: 'compensacion', label: 'Compensación por un error o reclamo' },
  { code: 'muestra', label: 'Muestra o prueba para un cliente nuevo' },
  { code: 'promocion', label: 'Promoción o lanzamiento' },
  { code: 'fidelizacion', label: 'Cliente frecuente o fidelización' },
  { code: 'volumen', label: 'Pedido grande que trae más trabajo' },
  {
    code: 'canje',
    label: 'Canje o colaboración (difusión, sorteo, influencer)',
  },
  { code: 'competencia', label: 'Igualar el precio de la competencia' },
  {
    code: 'costo_mal_cargado',
    label: 'El costo cargado está mal (el real es menor)',
  },
  { code: 'otro', label: 'Otro (texto)' },
] as const;

export type LossReasonCode = (typeof LOSS_REASONS)[number]['code'];

export const LOSS_REASON_NOTE_MAX = 255;

export function lossReasonLabel(code?: string | null): string {
  return LOSS_REASONS.find((r) => r.code === code)?.label ?? '';
}

/** Texto corto para avisos: "Vendido a pérdida · <motivo>[ · nota]". */
export function lossReasonNotice(
  code?: string | null,
  note?: string | null,
): string {
  const label = lossReasonLabel(code);
  if (!label) return '';
  const base = `Vendido a pérdida · ${label}`;
  return note?.trim() ? `${base} · ${note.trim()}` : base;
}
