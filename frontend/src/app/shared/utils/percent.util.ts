/** Redondea un porcentaje a entero para mostrar en UI (no muta el dato). */
export function formatPercentInteger(
  value: number | null | undefined,
): string | null {
  if (value == null || !Number.isFinite(Number(value))) return null;
  return String(Math.round(Number(value)));
}

/** Igual que formatPercentInteger, con el sufijo `%`. */
export function formatPercentIntegerLabel(
  value: number | null | undefined,
): string {
  const pct = formatPercentInteger(value);
  return pct == null ? '—' : `${pct}%`;
}
