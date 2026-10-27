import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CalendarEntryKind,
  CalendarLinkType,
  CalendarNotify,
  CalendarRepeat,
  OrderStatus,
} from '../common/enums';
import {
  CreateCalendarEntryDto,
  UpdateCalendarEntryDto,
} from '../common/dto';
import { CalendarEntry, CalendarFeedItem } from '../common/interfaces';
import {
  calendarDay,
  todayCalendarDay,
} from '../orders/due-date.util';
import { StoreService } from '../store/store.service';
import { expandEntryDates } from './calendar-repeat.util';

const OPEN_ORDER_STATUSES = new Set<OrderStatus>([
  OrderStatus.PENDIENTE,
  OrderStatus.EN_PROGRESO,
  OrderStatus.TERMINADO,
  OrderStatus.PARCIALMENTE_ENTREGADO,
]);

@Injectable()
export class CalendarService {
  constructor(private readonly store: StoreService) {}

  getFeed(fromRaw?: string, toRaw?: string): CalendarFeedItem[] {
    const today = todayCalendarDay();
    const from = calendarDay(fromRaw ?? '') ?? addMonths(today, -1);
    const to = calendarDay(toRaw ?? '') ?? addMonths(today, 2);
    if (from > to) {
      throw new BadRequestException('from debe ser anterior o igual a to');
    }

    const items: CalendarFeedItem[] = [];
    items.push(...this.deliveryItems(from, to, today));
    items.push(...this.entryItems(from, to));

    return items.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a.startTime ?? '').localeCompare(b.startTime ?? '');
    });
  }

  findAllEntries(): CalendarEntry[] {
    return [...this.store.calendarEntries];
  }

  findOneEntry(id: string): CalendarEntry {
    const entry = this.store.getCalendarEntryById(id);
    if (!entry) throw new NotFoundException('Entrada de calendario no encontrada');
    return entry;
  }

  createEntry(data: CreateCalendarEntryDto): CalendarEntry {
    const now = new Date().toISOString();
    const entry = this.normalizeEntry({
      id: this.store.nextCalendarEntryId(),
      kind: data.kind,
      title: data.title.trim(),
      notes: data.notes?.trim() || undefined,
      date: data.date,
      startTime: data.allDay ? undefined : data.startTime,
      endTime: data.allDay ? undefined : data.endTime,
      allDay: !!data.allDay,
      repeat: data.repeat ?? CalendarRepeat.NONE,
      weekdays: normalizeWeekdays(data.weekdays),
      notify: data.notify ?? CalendarNotify.NONE,
      linkType: data.linkType,
      linkId: data.linkId,
      createdAt: now,
      updatedAt: now,
    });
    this.validateEntry(entry);
    this.store.calendarEntries.push(entry);
    return entry;
  }

  updateEntry(id: string, data: UpdateCalendarEntryDto): CalendarEntry {
    const current = this.findOneEntry(id);
    const next = this.normalizeEntry({
      ...current,
      ...data,
      title: data.title !== undefined ? data.title.trim() : current.title,
      notes:
        data.notes !== undefined
          ? data.notes.trim() || undefined
          : current.notes,
      weekdays:
        data.weekdays !== undefined
          ? normalizeWeekdays(data.weekdays)
          : current.weekdays,
      allDay: data.allDay !== undefined ? !!data.allDay : current.allDay,
      updatedAt: new Date().toISOString(),
    });
    if (next.allDay) {
      next.startTime = undefined;
      next.endTime = undefined;
    }
    this.validateEntry(next);
    this.store.replaceCalendarEntry(next);
    return next;
  }

  completeEntry(id: string, completed: boolean): CalendarEntry {
    const current = this.findOneEntry(id);
    if (current.kind !== CalendarEntryKind.REMINDER) {
      throw new BadRequestException('Solo se pueden completar recordatorios');
    }
    const next: CalendarEntry = {
      ...current,
      completedAt: completed ? new Date().toISOString() : undefined,
      updatedAt: new Date().toISOString(),
    };
    this.store.replaceCalendarEntry(next);
    return next;
  }

  removeEntry(id: string): void {
    if (!this.store.removeCalendarEntry(id)) {
      throw new NotFoundException('Entrada de calendario no encontrada');
    }
  }

  /** Entries that should surface as dashboard notifications today. */
  buildNotifyCandidates(reference = new Date()): CalendarFeedItem[] {
    const today = todayCalendarDay(reference);
    const items = this.entryItems(addDays(today, -7), addDays(today, 7));
    return items.filter((item) => {
      if (!item.entryId) return false;
      const entry = this.store.getCalendarEntryById(item.entryId);
      if (!entry || entry.notify === CalendarNotify.NONE) return false;
      if (item.completed) return false;
      const notifyDay = notifyDateFor(item.date, entry.notify);
      return notifyDay === today;
    });
  }

  private deliveryItems(
    from: string,
    to: string,
    today: string,
  ): CalendarFeedItem[] {
    const items: CalendarFeedItem[] = [];
    for (const order of this.store.orders) {
      if (!OPEN_ORDER_STATUSES.has(order.status)) continue;
      const due = calendarDay(order.dueDate);
      if (!due || due < from || due > to) continue;
      const late = due < today;
      const qty = order.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
      items.push({
        id: `delivery-${order.id}`,
        type: 'delivery',
        date: due,
        title: `Entrega ${order.id}`,
        subtitle: `${order.customerName || 'Sin cliente'} · ${qty} piezas`,
        late,
        orderId: order.id,
        linkType: CalendarLinkType.ORDER,
        linkId: order.id,
        total: order.total,
        customerName: order.customerName,
      });
    }
    return items;
  }

  private entryItems(from: string, to: string): CalendarFeedItem[] {
    const items: CalendarFeedItem[] = [];
    for (const entry of this.store.calendarEntries) {
      const dates = expandEntryDates(entry, from, to);
      for (const date of dates) {
        items.push({
          id: `${entry.id}@${date}`,
          type: entry.kind === CalendarEntryKind.EVENT ? 'event' : 'reminder',
          date,
          title: entry.title,
          subtitle: this.entrySubtitle(entry),
          startTime: entry.startTime,
          endTime: entry.endTime,
          allDay: entry.allDay,
          completed: !!entry.completedAt,
          entryId: entry.id,
          linkType: entry.linkType,
          linkId: entry.linkId,
        });
      }
    }
    return items;
  }

  private entrySubtitle(entry: CalendarEntry): string | undefined {
    const parts: string[] = [];
    if (entry.kind === CalendarEntryKind.EVENT) parts.push('Evento');
    else parts.push('Recordatorio');
    if (entry.startTime && !entry.allDay) parts.push(entry.startTime);
    if (entry.repeat === CalendarRepeat.WEEKLY && entry.weekdays.length) {
      parts.push('se repite');
    }
    return parts.join(' · ');
  }

  private normalizeEntry(entry: CalendarEntry): CalendarEntry {
    return {
      ...entry,
      title: entry.title.trim(),
      weekdays: normalizeWeekdays(entry.weekdays),
      repeat: entry.repeat || CalendarRepeat.NONE,
      notify: entry.notify || CalendarNotify.NONE,
    };
  }

  private validateEntry(entry: CalendarEntry): void {
    if (!entry.title) {
      throw new BadRequestException('El título es obligatorio');
    }
    if (!calendarDay(entry.date)) {
      throw new BadRequestException('Fecha inválida');
    }
    if (entry.linkType && !entry.linkId) {
      throw new BadRequestException('linkId es obligatorio si hay linkType');
    }
    if (entry.linkId) {
      this.assertLinkExists(entry.linkType, entry.linkId);
    }
  }

  private assertLinkExists(
    linkType: CalendarLinkType | undefined,
    linkId: string,
  ): void {
    if (!linkType) return;
    if (linkType === CalendarLinkType.ORDER && !this.store.getOrderById(linkId)) {
      throw new BadRequestException('Pedido vinculado no encontrado');
    }
    if (linkType === CalendarLinkType.QUOTE && !this.store.getQuoteById(linkId)) {
      throw new BadRequestException('Presupuesto vinculado no encontrado');
    }
    if (
      linkType === CalendarLinkType.CUSTOMER &&
      !this.store.getCustomerById(linkId)
    ) {
      throw new BadRequestException('Cliente vinculado no encontrado');
    }
  }
}

function normalizeWeekdays(value: number[] | undefined): number[] {
  if (!value?.length) return [];
  return [
    ...new Set(
      value
        .map((n) => Number(n))
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7),
    ),
  ].sort((a, b) => a - b);
}

function addMonths(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const date = new Date(y, m - 1 + delta, d);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function notifyDateFor(eventDate: string, notify: CalendarNotify): string {
  switch (notify) {
    case CalendarNotify.AT_TIME:
    case CalendarNotify.ONE_HOUR:
      return eventDate;
    case CalendarNotify.ONE_DAY:
      return addDays(eventDate, -1);
    case CalendarNotify.ONE_WEEK:
      return addDays(eventDate, -7);
    default:
      return eventDate;
  }
}
