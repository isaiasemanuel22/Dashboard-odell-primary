import {
  CalendarEntryKind,
  CalendarLinkType,
  CalendarNotify,
  CalendarRepeat,
} from '../../common/enums';
import { CalendarEntry } from '../../common/interfaces';

function asWeekdays(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => Number(item))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7);
}

export function mapCalendarEntryFromDb(row: {
  id: string;
  kind: string;
  title: string;
  notes: string | null;
  date: string;
  startTime: string | null;
  endTime: string | null;
  allDay: boolean;
  repeat: string;
  weekdays: unknown;
  notify: string;
  linkType: string | null;
  linkId: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): CalendarEntry {
  return {
    id: row.id,
    kind: row.kind as CalendarEntryKind,
    title: row.title,
    notes: row.notes ?? undefined,
    date: row.date,
    startTime: row.startTime ?? undefined,
    endTime: row.endTime ?? undefined,
    allDay: row.allDay,
    repeat: (row.repeat as CalendarRepeat) || CalendarRepeat.NONE,
    weekdays: asWeekdays(row.weekdays),
    notify: (row.notify as CalendarNotify) || CalendarNotify.NONE,
    linkType: (row.linkType as CalendarLinkType) || undefined,
    linkId: row.linkId ?? undefined,
    completedAt: row.completedAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapCalendarEntryToDb(entry: CalendarEntry) {
  return {
    id: entry.id,
    kind: entry.kind,
    title: entry.title,
    notes: entry.notes ?? null,
    date: entry.date,
    startTime: entry.startTime ?? null,
    endTime: entry.endTime ?? null,
    allDay: entry.allDay,
    repeat: entry.repeat,
    weekdays: entry.weekdays ?? [],
    notify: entry.notify,
    linkType: entry.linkType ?? null,
    linkId: entry.linkId ?? null,
    completedAt: entry.completedAt ? new Date(entry.completedAt) : null,
    createdAt: new Date(entry.createdAt),
    updatedAt: new Date(entry.updatedAt),
  };
}
