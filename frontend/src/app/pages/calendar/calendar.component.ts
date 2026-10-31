import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  CalendarEntryKind,
  CalendarFeedItem,
  CalendarFeedType,
} from '../../core/models';
import { CalendarService } from '../../core/services/calendar.service';
import { RealtimeService } from '../../core/services/realtime.service';
import { FormDialogService } from '../../shared/form-dialogs/form-dialog.service';
import {
  DbButtonComponent,
  DbCalendarAgendaComponent,
  DbCalendarAgendaRow,
  DbCalendarDayCell,
  DbCalendarMonthComponent,
  DbPillGroupComponent,
  DbPillOption,
  DbSegmentOption,
  DbSegmentedControlComponent,
} from '@general-components';
import {
  addDaysYmd,
  addMonths,
  buildMonthCells,
  endOfMonth,
  formatDayLong,
  formatMonthTitle,
  formatWhenLabel,
  groupItemsByDate,
  startOfMonth,
  todayYmd,
  weekRangeContaining,
} from '../../shared/utils/calendar-grid.util';
import { extractApiErrorMessage } from '../../shared/utils/api-error';
import { CalendarSideComponent } from './calendar-side/calendar-side.component';

type CalendarView = 'month' | 'week' | 'list';
type CalendarFilter = 'todos' | CalendarFeedType;

const TYPE_COLORS: Record<CalendarFeedType | 'todos', string> = {
  todos: '#5B7083',
  delivery: '#0E7AAB',
  event: '#15803D',
  reminder: '#D97706',
};

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [
    DbButtonComponent,
    DbCalendarMonthComponent,
    DbCalendarAgendaComponent,
    DbPillGroupComponent,
    DbSegmentedControlComponent,
    CalendarSideComponent,
  ],
  templateUrl: './calendar.component.html',
  styleUrl: './calendar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarComponent implements OnInit {
  private readonly calendarService = inject(CalendarService);
  private readonly formDialogs = inject(FormDialogService);
  private readonly realtime = inject(RealtimeService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly eventKind = CalendarEntryKind.EVENT;
  readonly reminderKind = CalendarEntryKind.REMINDER;

  readonly viewOptions: DbSegmentOption<CalendarView>[] = [
    { value: 'month', label: 'Mes' },
    { value: 'week', label: 'Semana' },
    { value: 'list', label: 'Lista' },
  ];

  readonly filterOptions: DbPillOption<CalendarFilter>[] = [
    { value: 'todos', label: 'Todos', color: TYPE_COLORS.todos },
    { value: 'delivery', label: 'Entregas', color: TYPE_COLORS.delivery },
    { value: 'event', label: 'Eventos', color: TYPE_COLORS.event },
    { value: 'reminder', label: 'Recordatorios', color: TYPE_COLORS.reminder },
  ];

  view: CalendarView = 'month';
  filter: CalendarFilter = 'todos';
  cursorMonth = startOfMonth(todayYmd());
  loading = true;
  error = '';
  private allItems: CalendarFeedItem[] = [];

  monthCells: DbCalendarDayCell[] = [];
  weekCells: DbCalendarDayCell[] = [];
  listRows: DbCalendarAgendaRow[] = [];
  todayRows: DbCalendarAgendaRow[] = [];
  overdueRows: DbCalendarAgendaRow[] = [];
  upcomingRows: DbCalendarAgendaRow[] = [];
  overdueCount = 0;

  get monthTitle(): string {
    return formatMonthTitle(this.cursorMonth);
  }

  get todayLabel(): string {
    return formatDayLong(todayYmd());
  }

  get subtitleHtml(): string {
    if (this.overdueCount <= 0) {
      return 'Entregas de pedidos, eventos y recordatorios';
    }
    const n = this.overdueCount;
    const label =
      n === 1 ? '1 entrega atrasada' : `${n} entregas atrasadas`;
    return `Entregas de pedidos, eventos y recordatorios · <b>${label}</b>`;
  }

  ngOnInit(): void {
    this.reload();
    this.realtime.bindSmartReload(this.destroyRef, ['dashboard', 'calendar'], () =>
      this.reload(),
    );
  }

  prevPeriod(): void {
    if (this.view === 'week') {
      this.cursorMonth = addDaysYmd(this.cursorMonth, -7);
    } else {
      this.cursorMonth = addMonths(this.cursorMonth, -1);
    }
    this.reload();
  }

  nextPeriod(): void {
    if (this.view === 'week') {
      this.cursorMonth = addDaysYmd(this.cursorMonth, 7);
    } else {
      this.cursorMonth = addMonths(this.cursorMonth, 1);
    }
    this.reload();
  }

  goToday(): void {
    this.cursorMonth = startOfMonth(todayYmd());
    this.reload();
  }

  setView(view: CalendarView): void {
    this.view = view;
    this.rebuildViews();
    this.cdr.markForCheck();
  }

  setFilter(filter: CalendarFilter): void {
    this.filter = filter;
    this.rebuildViews();
    this.cdr.markForCheck();
  }

  openNew(kind: CalendarEntryKind, date?: string): void {
    this.formDialogs
      .openCalendarEvent({ presetKind: kind, presetDate: date })
      .subscribe((saved) => {
        if (saved) this.reload();
      });
  }

  onDayClick(day: DbCalendarDayCell): void {
    this.openNew(CalendarEntryKind.EVENT, day.date);
  }

  onItemClick(item: CalendarFeedItem): void {
    if (item.type === 'delivery' && item.orderId) {
      void this.router.navigate(['/pedidos', item.orderId]);
      return;
    }
    if (item.entryId) {
      this.calendarService.getEntry(item.entryId).subscribe({
        next: (entry) => {
          this.formDialogs.openCalendarEvent({ entry }).subscribe((saved) => {
            if (saved) this.reload();
          });
        },
      });
    }
  }

  onAgendaToggle(row: DbCalendarAgendaRow): void {
    const entryId = row.item?.entryId;
    if (!entryId || row.item?.type !== 'reminder') return;
    this.calendarService.completeEntry(entryId, !row.checked).subscribe({
      next: () => this.reload(),
      error: (err) => {
        alert(extractApiErrorMessage(err, 'No se pudo actualizar'));
      },
    });
  }

  onAgendaOpen(row: DbCalendarAgendaRow): void {
    if (row.item) this.onItemClick(row.item);
  }

  private reload(): void {
    this.loading = true;
    this.error = '';
    this.cdr.markForCheck();

    const from = addDaysYmd(startOfMonth(this.cursorMonth), -14);
    const to = addDaysYmd(endOfMonth(this.cursorMonth), 21);

    this.calendarService.getFeed(from, to).subscribe({
      next: (items) => {
        this.allItems = items;
        this.loading = false;
        this.rebuildViews();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loading = false;
        this.error = extractApiErrorMessage(err, 'No se pudo cargar el calendario');
        this.cdr.markForCheck();
      },
    });
  }

  private rebuildViews(): void {
    const filtered = this.filteredItems(this.allItems);
    const byDate = groupItemsByDate(filtered);
    const today = todayYmd();

    this.monthCells = buildMonthCells(this.cursorMonth, byDate, today);
    const week = weekRangeContaining(
      this.view === 'week' ? this.cursorMonth : today,
    );
    this.weekCells = this.buildWeekCells(week.from, byDate, today);

    const monthFrom = startOfMonth(this.cursorMonth);
    const monthTo = endOfMonth(this.cursorMonth);
    this.listRows = filtered
      .filter((item) => item.date >= monthFrom && item.date <= monthTo)
      .map((item) => this.toAgendaRow(item, true));

    this.todayRows = filtered
      .filter((item) => item.date === today && item.type === 'reminder')
      .map((item) => this.toAgendaRow(item, false, true));

    const overdue = this.allItems.filter(
      (item) => item.type === 'delivery' && item.late,
    );
    this.overdueCount = overdue.length;
    this.overdueRows = overdue.map((item) => ({
      id: item.id,
      title: item.title,
      subtitle: `Era el ${formatWhenLabel(item.date)} · ${item.customerName || 'Sin cliente'}${
        item.total != null
          ? ` · $ ${Math.round(item.total).toLocaleString('es-AR')}`
          : ''
      }`,
      barColor: '#B91C1C',
      linkLabel: 'Ver',
      item,
    }));

    const upcomingTo = addDaysYmd(today, 7);
    this.upcomingRows = filtered
      .filter((item) => item.date > today && item.date <= upcomingTo)
      .map((item) => this.toAgendaRow(item, true));
  }

  private filteredItems(items: CalendarFeedItem[]): CalendarFeedItem[] {
    if (this.filter === 'todos') return items;
    return items.filter((item) => item.type === this.filter);
  }

  private buildWeekCells(
    from: string,
    byDate: Map<string, CalendarFeedItem[]>,
    today: string,
  ): DbCalendarDayCell[] {
    const cells: DbCalendarDayCell[] = [];
    for (let i = 0; i < 7; i++) {
      const date = addDaysYmd(from, i);
      const all = byDate.get(date) ?? [];
      const d = new Date(date + 'T12:00:00');
      cells.push({
        date,
        dayNumber: d.getDate(),
        inMonth: true,
        isToday: date === today,
        isWeekend: d.getDay() === 0 || d.getDay() === 6,
        items: all.slice(0, 6),
        more: Math.max(0, all.length - 6),
        ariaLabel: date,
      });
    }
    return cells;
  }

  private toAgendaRow(
    item: CalendarFeedItem,
    withWhen: boolean,
    checkbox = false,
  ): DbCalendarAgendaRow {
    return {
      id: item.id,
      title: item.title,
      subtitle: item.subtitle,
      whenLabel: withWhen ? formatWhenLabel(item.date) : undefined,
      barColor: item.late
        ? '#B91C1C'
        : TYPE_COLORS[item.type],
      showCheckbox: checkbox || item.type === 'reminder',
      checked: !!item.completed,
      linkLabel: item.type === 'delivery' ? 'Ver' : undefined,
      item,
    };
  }
}
