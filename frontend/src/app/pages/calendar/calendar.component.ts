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
import { FormDialogService } from '../../modals/form-dialog.service';
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
  MobileBarComponent,
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
  parseYmd,
  startOfMonth,
  todayYmd,
  weekRangeContaining,
} from '../../shared/utils/calendar-grid.util';
import { extractApiErrorMessage } from '../../shared/utils/api-error';
import { CalendarSideComponent } from './calendar-side/calendar-side.component';

type CalendarView = 'month' | 'week' | 'list';
type CalendarFilter = 'todos' | CalendarFeedType;
/** Mobile: Agenda (lista) y Mes compacto. Semana desktop no entra en 390px. */
type MobileCalendarView = 'agenda' | 'month';

const TYPE_COLORS: Record<CalendarFeedType | 'todos', string> = {
  todos: '#5B7083',
  delivery: '#0E7AAB',
  event: '#15803D',
  reminder: '#D97706',
};

const TYPE_LABELS: Record<CalendarFeedType, string> = {
  delivery: 'Entrega',
  event: 'Evento',
  reminder: 'Recordatorio',
};

const DAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTH_NAMES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

export interface MobileWeekDay {
  date: string;
  shortName: string;
  dayNumber: number;
  selected: boolean;
  isToday: boolean;
  dotColor: string | null;
}

export interface MobileAgendaDay {
  date: string;
  header: string;
  isToday: boolean;
  items: CalendarFeedItem[];
}

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
    MobileBarComponent,
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
  readonly typeLabels = TYPE_LABELS;

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

  /** Mobile state */
  mobileView: MobileCalendarView = 'agenda';
  mobileSelectedDay = todayYmd();
  mobileWeekDays: MobileWeekDay[] = [];
  mobileAgendaDays: MobileAgendaDay[] = [];
  mobileMonthCells: DbCalendarDayCell[] = [];
  mobileWeekTitle = '';

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
    const today = todayYmd();
    this.cursorMonth = this.view === 'week' ? today : startOfMonth(today);
    this.mobileSelectedDay = today;
    this.reload();
  }

  setView(view: CalendarView): void {
    this.view = view;
    if (view === 'week') {
      const today = todayYmd();
      if (startOfMonth(this.cursorMonth) === startOfMonth(today)) {
        this.cursorMonth = today;
      }
    }
    this.rebuildViews();
    this.cdr.markForCheck();
  }

  setFilter(filter: CalendarFilter): void {
    this.filter = filter;
    this.rebuildViews();
    this.cdr.markForCheck();
  }

  setMobileView(view: MobileCalendarView): void {
    this.mobileView = view;
    if (view === 'month') {
      this.cursorMonth = startOfMonth(this.mobileSelectedDay);
    }
    this.rebuildViews();
    this.cdr.markForCheck();
  }

  prevMobileWeek(): void {
    this.mobileSelectedDay = addDaysYmd(this.mobileSelectedDay, -7);
    this.cursorMonth = startOfMonth(this.mobileSelectedDay);
    this.rebuildViews();
    this.cdr.markForCheck();
  }

  nextMobileWeek(): void {
    this.mobileSelectedDay = addDaysYmd(this.mobileSelectedDay, 7);
    this.cursorMonth = startOfMonth(this.mobileSelectedDay);
    this.rebuildViews();
    this.cdr.markForCheck();
  }

  prevMobileMonth(): void {
    this.cursorMonth = addMonths(this.cursorMonth, -1);
    this.mobileSelectedDay = this.cursorMonth;
    this.rebuildViews();
    this.cdr.markForCheck();
  }

  nextMobileMonth(): void {
    this.cursorMonth = addMonths(this.cursorMonth, 1);
    this.mobileSelectedDay = this.cursorMonth;
    this.rebuildViews();
    this.cdr.markForCheck();
  }

  selectMobileDay(date: string): void {
    this.mobileSelectedDay = date;
    this.cursorMonth = startOfMonth(date);
    if (this.mobileView === 'month') {
      this.mobileView = 'agenda';
    }
    this.rebuildViews();
    this.cdr.markForCheck();
  }

  itemBarColor(item: CalendarFeedItem): string {
    return item.late ? '#B91C1C' : TYPE_COLORS[item.type];
  }

  itemTimeLabel(item: CalendarFeedItem): string {
    if (item.allDay || !item.startTime) return '';
    return item.startTime.slice(0, 5);
  }

  itemTypeLabel(item: CalendarFeedItem): string {
    return TYPE_LABELS[item.type] ?? '';
  }

  openNew(kind: CalendarEntryKind, date?: string): void {
    this.formDialogs
      .openCalendarEvent({
        presetKind: kind,
        presetDate: date ?? this.mobileSelectedDay,
      })
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

    const today = todayYmd();
    const viewFrom = addDaysYmd(startOfMonth(this.cursorMonth), -14);
    const viewTo = addDaysYmd(endOfMonth(this.cursorMonth), 21);
    const horizonFrom = addDaysYmd(today, -400);
    const horizonTo = addDaysYmd(today, 14);
    const from = viewFrom < horizonFrom ? viewFrom : horizonFrom;
    const to = viewTo > horizonTo ? viewTo : horizonTo;

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
    const weekAnchor =
      this.view === 'week' ? this.cursorMonth : today;
    const week = weekRangeContaining(weekAnchor);
    this.weekCells = this.buildWeekCells(week.from, byDate, today);

    const monthFrom = startOfMonth(this.cursorMonth);
    const monthTo = endOfMonth(this.cursorMonth);
    this.listRows = filtered
      .filter((item) => item.date >= monthFrom && item.date <= monthTo)
      .map((item) => this.toAgendaRow(item, true));

    this.todayRows = filtered
      .filter(
        (item) =>
          item.date === today &&
          (item.type === 'reminder' || item.type === 'event'),
      )
      .map((item) => this.toAgendaRow(item, false, item.type === 'reminder'));

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

    this.rebuildMobileViews(byDate, today);
  }

  private rebuildMobileViews(
    byDate: Map<string, CalendarFeedItem[]>,
    today: string,
  ): void {
    const week = weekRangeContaining(this.mobileSelectedDay);
    const fromDate = parseYmd(week.from);
    const toDate = parseYmd(week.to);
    const monthName = MONTH_NAMES[toDate.getMonth()];
    this.mobileWeekTitle = `${fromDate.getDate()} – ${toDate.getDate()} de ${monthName}`;

    this.mobileWeekDays = [];
    for (let i = 0; i < 7; i++) {
      const date = addDaysYmd(week.from, i);
      const d = parseYmd(date);
      const items = byDate.get(date) ?? [];
      this.mobileWeekDays.push({
        date,
        shortName: DAY_SHORT[d.getDay()],
        dayNumber: d.getDate(),
        selected: date === this.mobileSelectedDay,
        isToday: date === today,
        dotColor: this.dayDotColor(items),
      });
    }

    this.mobileAgendaDays = [];
    for (let i = 0; i < 7; i++) {
      const date = addDaysYmd(week.from, i);
      this.mobileAgendaDays.push({
        date,
        header: this.mobileDayHeader(date, today),
        isToday: date === today,
        items: byDate.get(date) ?? [],
      });
    }

    this.mobileMonthCells = buildMonthCells(this.cursorMonth, byDate, today);
  }

  get mobileOverdueSummary(): { title: string; subtitle: string } | null {
    if (this.overdueCount <= 0) return null;
    const overdue = this.allItems.filter(
      (item) => item.type === 'delivery' && item.late,
    );
    const title =
      this.overdueCount === 1
        ? '1 entrega atrasada'
        : `${this.overdueCount} entregas atrasadas`;
    const subtitle = overdue
      .slice(0, 3)
      .map(
        (item) =>
          `${item.orderId || ''} ${item.customerName || ''}`.trim(),
      )
      .filter(Boolean)
      .join(' · ');
    return { title, subtitle };
  }

  openOverdueOrders(): void {
    void this.router.navigate(['/pedidos'], {
      queryParams: { filtro: 'atrasados' },
    });
  }

  private dayDotColor(items: CalendarFeedItem[]): string | null {
    if (!items.length) return null;
    const late = items.find((item) => item.late);
    if (late) return '#B91C1C';
    return TYPE_COLORS[items[0].type];
  }

  private mobileDayHeader(date: string, today: string): string {
    const d = parseYmd(date);
    const weekday = d
      .toLocaleDateString('es-AR', { weekday: 'long' })
      .toUpperCase();
    const day = d.getDate();
    if (date === today) return `${weekday} ${day} · HOY`;
    return `${weekday} ${day}`;
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
