import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { DbCalendarAgendaRow } from './db-calendar-agenda.types';

@Component({
  selector: 'db-calendar-agenda',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './db-calendar-agenda.component.html',
  styleUrl: './db-calendar-agenda.component.scss',
})
export class DbCalendarAgendaComponent {
  readonly rows = input.required<DbCalendarAgendaRow[]>();
  readonly emptyText = input('Sin elementos');

  readonly toggle = output<DbCalendarAgendaRow>();
  readonly open = output<DbCalendarAgendaRow>();
}
