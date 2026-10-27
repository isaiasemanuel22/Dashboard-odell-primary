import { CalendarFeedItem } from '../../core/models';

export interface DbCalendarDayCell {
  date: string;
  dayNumber: number;
  inMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  items: CalendarFeedItem[];
  more: number;
  ariaLabel: string;
}
