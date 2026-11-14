/** Número con coma decimal (es-AR), sin ceros sobrantes: 14,2 · 0,5 · 3. */
export function formatDecimalEs(value: number, maxDecimals = 2): string {
  const safe = Number(value);
  if (!Number.isFinite(safe)) return '0';
  return new Intl.NumberFormat('es-AR', {
    maximumFractionDigits: maxDecimals,
  }).format(safe);
}

/** Horas con coma decimal: «14,2 h». */
export function formatHoursEs(value: number, maxDecimals = 2): string {
  return `${formatDecimalEs(value, maxDecimals)} h`;
}
