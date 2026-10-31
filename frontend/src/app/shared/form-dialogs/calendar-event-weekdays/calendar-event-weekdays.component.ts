import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-calendar-event-weekdays',
  standalone: true,
  templateUrl: './calendar-event-weekdays.component.html',
  styleUrl: './calendar-event-weekdays.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarEventWeekdaysComponent {
  @Input() labels: string[] = [];
  @Input() selected: number[] = [];
  @Output() toggleDay = new EventEmitter<number>();

  isOn(day: number): boolean {
    return this.selected.includes(day);
  }
}
