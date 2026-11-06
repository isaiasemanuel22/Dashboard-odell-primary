import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
} from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { CalendarFeedType } from '../core/models';
import {
  DbButtonComponent,
  MobileChipGroupComponent,
} from '@general-components';

export type CalendarMobileFilter = 'todos' | CalendarFeedType;

export interface CalendarFiltersSheetData {
  filter: CalendarMobileFilter;
  /** Ítems del feed ya cargados (sin filtro de tipo) para el contador en vivo. */
  itemCountByType: Record<CalendarMobileFilter, number>;
}

@Component({
  standalone: true,
  imports: [DbButtonComponent, MobileChipGroupComponent],
  templateUrl: './calendar-filters-sheet.component.html',
  styleUrl: './calendar-filters-sheet.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarFiltersSheetComponent {
  private readonly data = inject<CalendarFiltersSheetData>(DIALOG_DATA);
  private readonly dialogRef =
    inject<DialogRef<CalendarMobileFilter | undefined>>(DialogRef);
  private readonly cdr = inject(ChangeDetectorRef);

  draft: CalendarMobileFilter = this.data.filter;

  readonly typeOptions: { value: CalendarMobileFilter; label: string; count?: number }[] =
    [
      {
        value: 'todos',
        label: 'Todos',
        count: this.data.itemCountByType.todos,
      },
      {
        value: 'delivery',
        label: 'Entregas',
        count: this.data.itemCountByType.delivery,
      },
      {
        value: 'event',
        label: 'Eventos',
        count: this.data.itemCountByType.event,
      },
      {
        value: 'reminder',
        label: 'Recordatorios',
        count: this.data.itemCountByType.reminder,
      },
    ];

  get applyLabel(): string {
    const n = this.data.itemCountByType[this.draft] ?? 0;
    return n === 1 ? 'Ver 1 ítem' : `Ver ${n} ítems`;
  }

  onTypeChange(value: CalendarMobileFilter | null): void {
    if (value == null) return;
    this.draft = value;
    this.cdr.markForCheck();
  }

  clearAll(): void {
    this.draft = 'todos';
    this.cdr.markForCheck();
  }

  apply(): void {
    this.dialogRef.close(this.draft);
  }

  cancel(): void {
    this.dialogRef.close(undefined);
  }
}

export function countCalendarMobileFilters(filter: CalendarMobileFilter): number {
  return filter === 'todos' ? 0 : 1;
}
