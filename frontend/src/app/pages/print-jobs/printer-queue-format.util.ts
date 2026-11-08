/** Formatos de la vista «Por impresora» (español rioplatense). */

const AR_TZ = 'America/Argentina/Buenos_Aires';

export function formatDecimalHours(hours: number): string {
  const n = Number(hours) || 0;
  return n.toLocaleString('es-AR', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  });
}

export function parseYmdParts(ymd: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd.trim());
  if (!match) return null;
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12),
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

/** «lunes 09/11» o «Lun 09/11» si short. */
export function formatYmdWeekdayDdMm(
  ymd: string,
  opts: { short?: boolean } = {},
): string {
  const date = parseYmdParts(ymd);
  if (!date) return ymd;
  const weekday = date
    .toLocaleDateString('es-AR', {
      weekday: opts.short ? 'short' : 'long',
      timeZone: 'UTC',
    })
    .replace(/\./g, '')
    .trim();
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dayLabel = opts.short
    ? weekday.charAt(0).toUpperCase() + weekday.slice(1).toLowerCase()
    : weekday.toLowerCase();
  return `${dayLabel} ${dd}/${mm}`;
}

/** «Entrega lunes 09/11» */
export function formatDeliveryLine(ymd: string): string {
  return `Entrega ${formatYmdWeekdayDdMm(ymd)}`;
}

function arParts(iso: string): {
  ymd: string;
  hhmm: string;
  weekdayShort: string;
} | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: AR_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? '';
  const ymd = `${get('year')}-${get('month')}-${get('day')}`;
  const hhmm = `${get('hour')}:${get('minute')}`;
  const weekdayShort = date
    .toLocaleDateString('es-AR', {
      weekday: 'short',
      timeZone: AR_TZ,
    })
    .replace(/\./g, '')
    .trim();
  return { ymd, hhmm, weekdayShort };
}

export function todayArYmd(reference = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: AR_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(reference);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function formatBusyUntilLabel(busyUntil: string | null): string {
  if (!busyUntil) return 'Libre ahora';
  const parts = arParts(busyUntil);
  if (!parts) return 'Libre ahora';
  return `${formatYmdWeekdayDdMm(parts.ymd)} · ${parts.hhmm}`;
}

export function formatScheduleRange(
  start: string | null,
  end: string | null,
  inProgress: boolean,
): string {
  if (!start || !end) return '';
  const startParts = arParts(start);
  const endParts = arParts(end);
  if (!startParts || !endParts) return '';

  const today = todayArYmd();

  if (inProgress) {
    if (endParts.ymd === today) {
      return `Ahora · termina ${endParts.hhmm}`;
    }
    const endDay = formatYmdWeekdayDdMm(endParts.ymd, { short: true });
    const endDayLower = endDay.charAt(0).toLowerCase() + endDay.slice(1);
    return `Ahora · termina ${endDayLower} · ${endParts.hhmm}`;
  }

  if (startParts.ymd === endParts.ymd) {
    if (startParts.ymd === today) {
      return `${startParts.hhmm} – ${endParts.hhmm}`;
    }
    const day = formatYmdWeekdayDdMm(startParts.ymd, { short: true });
    return `${day} · ${startParts.hhmm} – ${endParts.hhmm}`;
  }

  const startDay = formatYmdWeekdayDdMm(startParts.ymd, { short: true });
  const endDay = formatYmdWeekdayDdMm(endParts.ymd, { short: true });
  return `${startDay} · ${startParts.hhmm} – ${endDay} · ${endParts.hhmm}`;
}

export function formatCapacityDayHeader(ymd: string): string {
  const date = parseYmdParts(ymd);
  if (!date) return ymd;
  const weekday = date
    .toLocaleDateString('es-AR', { weekday: 'short', timeZone: 'UTC' })
    .replace(/\./g, '')
    .trim();
  const label =
    weekday.charAt(0).toUpperCase() + weekday.slice(1).toLowerCase();
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${label} ${dd}`;
}

export function formatProgressPct(progress: number | null | undefined): string {
  if (progress == null || !Number.isFinite(progress)) return '';
  return `${Math.round(progress * 100)}%`;
}
