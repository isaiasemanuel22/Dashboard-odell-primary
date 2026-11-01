/** Fecha corta rioplatense: «31 de oct»; con año solo si no es el actual. */
export function formatDateDayMonth(
  value: string | Date | null | undefined,
  now: Date = new Date(),
): string {
  if (value == null || value === '') return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  const includeYear = date.getFullYear() !== now.getFullYear();
  const raw = date.toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    ...(includeYear ? { year: 'numeric' as const } : {}),
  });

  const cleaned = raw.replace(/\./g, '').replace(/\s+/g, ' ').trim();
  const parts = cleaned.split(' ');
  const day = parts[0];
  const month = parts.find((part, index) => index > 0 && !/^(de|\d+)$/i.test(part));
  if (!day || !month) return cleaned;

  if (includeYear) {
    const year = parts[parts.length - 1];
    return `${day} de ${month} de ${year}`;
  }
  return `${day} de ${month}`;
}
