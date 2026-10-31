import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import {
  CalendarEntry,
  CalendarEntryKind,
  CalendarLinkType,
  CalendarNotify,
  CalendarRepeat,
  CreateCalendarEntryPayload,
  Customer,
  Order,
  Quote,
} from '../../core/models';
import { CalendarService } from '../../core/services/calendar.service';
import { CustomersService } from '../../core/services/customers.service';
import { OrdersService } from '../../core/services/orders.service';
import { QuotesService } from '../../core/services/quotes.service';
import {
  DbButtonComponent,
  DbCheckboxComponent,
  DbInputComponent,
  DbSelectComponent,
  DbSelectOption,
  DbTextareaComponent,
  DbSegmentedControlComponent,
  DbSegmentOption,
} from '@general-components';
import { FormDialogShellComponent } from '../../components/form-dialog-shell/form-dialog-shell.component';
import { CalendarEventWeekdaysComponent } from './calendar-event-weekdays/calendar-event-weekdays.component';
import { extractApiErrorMessage } from '../utils/api-error';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface CalendarEventDialogData {
  entry?: CalendarEntry | null;
  presetKind?: CalendarEntryKind;
  presetDate?: string;
}

const WEEKDAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

@Component({
  standalone: true,
  imports: [
    FormsModule,
    FormDialogShellComponent,
    DbButtonComponent,
    DbInputComponent,
    DbSelectComponent,
    DbTextareaComponent,
    DbCheckboxComponent,
    DbSegmentedControlComponent,
    CalendarEventWeekdaysComponent,
  ],
  templateUrl: './calendar-event-dialog.component.html',
  styleUrl: './calendar-event-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarEventDialogComponent implements OnInit {
  private readonly calendarService = inject(CalendarService);
  private readonly ordersService = inject(OrdersService);
  private readonly quotesService = inject(QuotesService);
  private readonly customersService = inject(CustomersService);
  private readonly dialogRef = inject(DialogRef<CalendarEntry | undefined>);
  private readonly data = inject<CalendarEventDialogData>(DIALOG_DATA);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly kindOptions: DbSegmentOption<CalendarEntryKind>[] = [
    {
      value: CalendarEntryKind.EVENT,
      label: 'Evento',
      activeClass: 'on-ev',
    },
    {
      value: CalendarEntryKind.REMINDER,
      label: 'Recordatorio',
      activeClass: 'on-rec',
    },
  ];

  readonly weekdayLabels = WEEKDAY_LABELS;
  readonly CalendarRepeat = CalendarRepeat;
  readonly CalendarEntryKind = CalendarEntryKind;

  kind: CalendarEntryKind = CalendarEntryKind.EVENT;
  title = '';
  date = '';
  startTime = '';
  endTime = '';
  allDay = false;
  repeat: CalendarRepeat = CalendarRepeat.NONE;
  weekdays: number[] = [];
  notify: CalendarNotify = CalendarNotify.NONE;
  linkKey = '';
  notes = '';

  loading = false;
  error = '';

  repeatOptions: DbSelectOption[] = [
    { value: CalendarRepeat.NONE, label: 'No se repite' },
    { value: CalendarRepeat.WEEKLY, label: 'Cada semana' },
    { value: CalendarRepeat.MONTHLY, label: 'Cada mes' },
    { value: CalendarRepeat.YEARLY, label: 'Cada año' },
  ];

  notifyOptions: DbSelectOption[] = [
    { value: CalendarNotify.NONE, label: 'Sin aviso' },
    { value: CalendarNotify.AT_TIME, label: 'A la hora del evento' },
    { value: CalendarNotify.ONE_HOUR, label: '1 hora antes' },
    { value: CalendarNotify.ONE_DAY, label: '1 día antes' },
    { value: CalendarNotify.ONE_WEEK, label: '1 semana antes' },
  ];

  linkOptions: DbSelectOption[] = [{ value: '', label: 'Nada · opcional' }];

  get isEdit(): boolean {
    return !!this.data.entry;
  }

  get dialogTitle(): string {
    if (this.isEdit) {
      return this.kind === CalendarEntryKind.REMINDER
        ? 'Editar recordatorio'
        : 'Editar evento';
    }
    return this.kind === CalendarEntryKind.REMINDER
      ? 'Nuevo recordatorio'
      : 'Nuevo evento';
  }

  get repeatHint(): string {
    if (this.repeat !== CalendarRepeat.WEEKLY || !this.weekdays.length) {
      return '';
    }
    const names = this.weekdays
      .map((d) => WEEKDAY_LABELS[d - 1])
      .join(' y ');
    return `Se repite ${names} hasta que lo pares`;
  }

  ngOnInit(): void {
    const entry = this.data.entry;
    if (entry) {
      this.kind = entry.kind;
      this.title = entry.title;
      this.date = entry.date;
      this.startTime = entry.startTime ?? '';
      this.endTime = entry.endTime ?? '';
      this.allDay = entry.allDay;
      this.repeat = entry.repeat;
      this.weekdays = [...entry.weekdays];
      this.notify = entry.notify;
      this.notes = entry.notes ?? '';
      if (entry.linkType && entry.linkId) {
        this.linkKey = `${entry.linkType}:${entry.linkId}`;
      }
    } else {
      this.kind = this.data.presetKind ?? CalendarEntryKind.EVENT;
      this.date = this.data.presetDate ?? todayLocal();
      if (this.kind === CalendarEntryKind.EVENT) {
        this.notify = CalendarNotify.ONE_DAY;
      }
    }

    forkJoin({
      orders: this.ordersService.getOrders().pipe(catchError(() => of([] as Order[]))),
      quotes: this.quotesService.getQuotes().pipe(catchError(() => of([] as Quote[]))),
      customers: this.customersService
        .getCustomers()
        .pipe(catchError(() => of([] as Customer[]))),
    }).subscribe(({ orders, quotes, customers }) => {
      this.linkOptions = [
        { value: '', label: 'Nada · opcional' },
        ...orders.slice(0, 40).map((order) => ({
          value: `order:${order.id}`,
          label: `Pedido ${order.id} · ${order.customerName || 'Sin cliente'}`,
        })),
        ...quotes.slice(0, 40).map((quote) => ({
          value: `quote:${quote.id}`,
          label: `Presupuesto ${quote.id} · ${quote.customerName || 'Sin cliente'}`,
        })),
        ...customers.slice(0, 40).map((customer) => ({
          value: `customer:${customer.id}`,
          label: `Cliente · ${customer.name}`,
        })),
      ];
      this.cdr.markForCheck();
    });
  }

  toggleWeekday(day: number): void {
    if (this.weekdays.includes(day)) {
      this.weekdays = this.weekdays.filter((d) => d !== day);
    } else {
      this.weekdays = [...this.weekdays, day].sort((a, b) => a - b);
    }
  }

  cancel(): void {
    this.dialogRef.close(undefined);
  }

  save(): void {
    if (!this.title.trim() || !this.date) {
      this.error = 'Completá título y fecha.';
      this.cdr.markForCheck();
      return;
    }

    const payload = this.buildPayload();
    this.loading = true;
    this.error = '';
    this.cdr.markForCheck();

    const request = this.data.entry
      ? this.calendarService.updateEntry(this.data.entry.id, payload)
      : this.calendarService.createEntry(payload);

    request.subscribe({
      next: (saved) => {
        this.loading = false;
        this.dialogRef.close(saved);
      },
      error: (err) => {
        this.loading = false;
        this.error = extractApiErrorMessage(err, 'No se pudo guardar');
        this.cdr.markForCheck();
      },
    });
  }

  private buildPayload(): CreateCalendarEntryPayload {
    let linkType: CalendarLinkType | undefined;
    let linkId: string | undefined;
    if (this.linkKey.includes(':')) {
      const [type, id] = this.linkKey.split(':');
      linkType = type as CalendarLinkType;
      linkId = id;
    }

    return {
      kind: this.kind,
      title: this.title.trim(),
      notes: this.notes.trim() || undefined,
      date: this.date,
      startTime: this.allDay ? undefined : this.startTime || undefined,
      endTime: this.allDay ? undefined : this.endTime || undefined,
      allDay: this.allDay,
      repeat: this.repeat,
      weekdays:
        this.repeat === CalendarRepeat.WEEKLY ? this.weekdays : [],
      notify: this.notify,
      linkType,
      linkId,
    };
  }
}

function todayLocal(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
