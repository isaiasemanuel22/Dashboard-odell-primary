import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';

export interface MobilePeriodOption<T extends string = string> {
  value: T;
  label: string;
}

/**
 * Selector de período mobile: segmentos (Mes/Trimestre/Año) o
 * mes con flechas.
 */
@Component({
  selector: 'db-mobile-period-picker',
  standalone: true,
  templateUrl: './mobile-period-picker.component.html',
  styleUrl: './mobile-period-picker.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobilePeriodPickerComponent<T extends string = string> {
  readonly mode = input<'segments' | 'month'>('segments');
  readonly options = input<MobilePeriodOption<T>[]>([]);
  readonly value = input<T | null>(null);
  readonly monthLabel = input<string | null>(null);
  readonly caption = input<string | null>(null);
  readonly ariaLabel = input('Período');

  readonly valueChange = output<T>();
  readonly prev = output<void>();
  readonly next = output<void>();

  protected onSelect(opt: MobilePeriodOption<T>): void {
    this.valueChange.emit(opt.value);
  }

  protected onPrev(): void {
    this.prev.emit();
  }

  protected onNext(): void {
    this.next.emit();
  }
}
