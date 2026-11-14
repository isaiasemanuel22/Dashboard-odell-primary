import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  forwardRef,
  inject,
} from '@angular/core';
import {
  ControlValueAccessor,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';
import {
  formatArsAmountEditable,
  formatCurrencyArsExact,
  parseArsAmount,
} from '../../shared/utils/currency-ars.util';

/**
 * Monto grande mobile: centrado, 30px, subrayado.
 * En foco muestra el número editable; fuera de foco, `$ 26.845`.
 */
@Component({
  selector: 'db-mobile-amount-input',
  standalone: true,
  templateUrl: './mobile-amount-input.component.html',
  styleUrl: './mobile-amount-input.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => MobileAmountInputComponent),
      multi: true,
    },
  ],
})
export class MobileAmountInputComponent implements ControlValueAccessor {
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() label = 'Monto';
  @Input() name = 'mobileAmount';
  @Input() ariaLabel?: string;
  /** Si es true, conserva el signo "-" para que el formulario pueda avisar; si no, se descarta. */
  @Input() allowNegative = false;
  @Output() readonly amountChange = new EventEmitter<number | null>();

  @ViewChild('amountInput') private readonly amountInput?: ElementRef<HTMLInputElement>;

  value: number | null = null;
  editing = false;
  disabled = false;
  /** Texto tal cual lo escribe el usuario mientras edita (conserva la coma final, ceros, etc.). */
  private rawText = '';

  private onChange: (value: number | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  get displayValue(): string {
    if (this.editing) {
      return this.rawText;
    }
    if (this.value == null || !Number.isFinite(this.value) || this.value === 0) {
      return '';
    }
    return formatCurrencyArsExact(this.value);
  }

  writeValue(value: number | null): void {
    const next = value == null || value === ('' as unknown) ? null : Number(value);
    this.value = next != null && Number.isFinite(next) ? next : null;
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (value: number | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    this.cdr.markForCheck();
  }

  onFocus(): void {
    this.editing = true;
    this.rawText =
      this.value == null || !Number.isFinite(this.value)
        ? ''
        : formatArsAmountEditable(this.value);
    this.cdr.markForCheck();
    queueMicrotask(() => {
      const el = this.amountInput?.nativeElement;
      if (!el) return;
      el.select();
    });
  }

  onBlur(): void {
    this.editing = false;
    this.onTouched();
    this.cdr.markForCheck();
  }

  onInput(raw: string): void {
    const negative = this.allowNegative && raw.trim().startsWith('-');
    const cleaned = `${negative ? '-' : ''}${raw.replace(/[^\d.,]/g, '')}`;
    this.rawText = cleaned;
    const parsed = parseArsAmount(cleaned);
    this.setValue(parsed);
  }

  focus(): void {
    this.amountInput?.nativeElement.focus();
  }

  private setValue(next: number | null): void {
    this.value = next;
    this.onChange(next);
    this.amountChange.emit(next);
    this.cdr.markForCheck();
  }
}
