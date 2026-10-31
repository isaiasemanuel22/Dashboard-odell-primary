import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { CalendarFeedItem } from '../../core/models';
import { DbCalendarDayCell } from './db-calendar-month.types';

@Component({
  selector: 'db-calendar-month',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './db-calendar-month.component.html',
  styleUrl: './db-calendar-month.component.scss',
})
export class DbCalendarMonthComponent {
  readonly days = input.required<DbCalendarDayCell[]>();
  readonly ariaLabel = input('Calendario');
  readonly maxVisible = input(3);

  readonly dayClick = output<DbCalendarDayCell>();
  readonly itemClick = output<CalendarFeedItem>();

  itemClass(item: CalendarFeedItem, isPast: boolean): string {
    const parts = ['db-cal-it'];
    if (item.late) parts.push('db-cal-it--late');
    else if (item.type === 'delivery') parts.push('db-cal-it--ent');
    else if (item.type === 'event') parts.push('db-cal-it--ev');
    else parts.push('db-cal-it--rec');
    if (isPast && item.type !== 'event' && !item.late) parts.push('is-past');
    if (item.completed) parts.push('is-past');
    return parts.join(' ');
  }

  isPastDay(date: string): boolean {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return date < `${y}-${m}-${d}`;
  }

  onItemClick(event: Event, item: CalendarFeedItem): void {
    event.stopPropagation();
    this.itemClick.emit(item);
  }
}
