import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';

export interface MobileChipOption<T extends string = string> {
  value: T;
  label: string;
  count?: number;
}

@Component({
  selector: 'db-mobile-chip-group',
  standalone: true,
  templateUrl: './mobile-chip-group.component.html',
  styleUrl: './mobile-chip-group.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileChipGroupComponent<T extends string = string> {
  @Input() options: MobileChipOption<T>[] = [];
  /** Selección múltiple. Si es false, usa `value` / `valueChange`. */
  @Input() multiple = false;
  /** En selección única, tocar de nuevo la opción activa la deselecciona. */
  @Input() clearable = false;
  @Input() value: T | null = null;
  @Input() values: T[] = [];
  @Input() ariaLabel?: string;

  @Output() readonly valueChange = new EventEmitter<T | null>();
  @Output() readonly valuesChange = new EventEmitter<T[]>();

  isOn(optionValue: T): boolean {
    if (this.multiple) {
      return this.values.includes(optionValue);
    }
    return this.value === optionValue;
  }

  onToggle(optionValue: T): void {
    if (this.multiple) {
      const next = this.values.includes(optionValue)
        ? this.values.filter((item) => item !== optionValue)
        : [...this.values, optionValue];
      this.valuesChange.emit(next);
      return;
    }
    if (this.clearable && this.value === optionValue) {
      this.valueChange.emit(null);
      return;
    }
    this.valueChange.emit(optionValue);
  }
}
