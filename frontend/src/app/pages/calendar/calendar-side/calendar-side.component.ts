import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import {
  DbCalendarAgendaComponent,
  DbCalendarAgendaRow,
} from '@general-components';

@Component({
  selector: 'app-calendar-side',
  standalone: true,
  imports: [DbCalendarAgendaComponent],
  templateUrl: './calendar-side.component.html',
  styleUrl: './calendar-side.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cal-side' },
})
export class CalendarSideComponent {
  @Input() todayLabel = '';
  @Input() todayRows: DbCalendarAgendaRow[] = [];
  @Input() overdueCount = 0;
  @Input() overdueRows: DbCalendarAgendaRow[] = [];
  @Input() upcomingRows: DbCalendarAgendaRow[] = [];

  @Output() toggleRow = new EventEmitter<DbCalendarAgendaRow>();
  @Output() openRow = new EventEmitter<DbCalendarAgendaRow>();
  @Output() showList = new EventEmitter<void>();
}
