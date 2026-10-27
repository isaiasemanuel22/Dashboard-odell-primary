import { CalendarFeedItem } from '../../core/models';

export type DbCalendarAgendaVariant = 'default' | 'today' | 'overdue' | 'upcoming';

export interface DbCalendarAgendaRow {
  id: string;
  title: string;
  subtitle?: string;
  whenLabel?: string;
  barColor?: string;
  showCheckbox?: boolean;
  checked?: boolean;
  linkLabel?: string;
  item?: CalendarFeedItem;
}
