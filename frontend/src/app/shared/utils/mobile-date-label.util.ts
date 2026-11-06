const MONTHS_SHORT = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
] as const;

/** Etiqueta mobile de fecha: «Hoy, 6 nov» o «6 nov 2025». */
export function formatMobileDateLabel(
  isoDate: string | null | undefined,
  now: Date = new Date(),
): string {
  if (!isoDate) return '';
  const parts = isoDate.slice(0, 10).split('-');
  if (parts.length !== 3) return isoDate;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!year || !month || !day) return isoDate;

  const monthLabel = MONTHS_SHORT[month - 1] ?? '';
  const today = toDateKey(now);
  const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  if (key === today) {
    return `Hoy, ${day} ${monthLabel}`;
  }
  if (year === now.getFullYear()) {
    return `${day} ${monthLabel}`;
  }
  return `${day} ${monthLabel} ${year}`;
}

function toDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
