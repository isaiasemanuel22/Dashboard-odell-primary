import {
  Component,
  ElementRef,
  forwardRef,
  Input,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import {
  ControlValueAccessor,
  FormsModule,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';
import { DbFormFieldComponent } from '../db-form-field/db-form-field.component';

let dbInputId = 0;

@Component({
  selector: 'db-input',
  standalone: true,
  imports: [FormsModule, DbFormFieldComponent],
  templateUrl: './db-input.component.html',
  styleUrl: './db-input.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DbInputComponent),
      multi: true,
    },
  ],
})
export class DbInputComponent implements ControlValueAccessor, OnChanges {
  @Input() label = '';
  /** Nombre accesible cuando no hay label visible (p. ej. celdas de tabla). */
  @Input() ariaLabel = '';
  @Input() hint = '';
  @Input() error = '';
  @Input() required = false;
  @Input() type: 'text' | 'number' | 'search' | 'password' | 'email' | 'date' = 'text';
  @Input() placeholder = '';
  @Input() name = '';
  @Input() min?: number | string;
  @Input() max?: number | string;
  @Input() step?: number | string;
  @Input() readonly = false;
  @Input() disabled = false;
  @Input() list?: string;
  @Input() autocomplete = 'off';
  @Input() id = '';

  private readonly autoId = `db-input-${++dbInputId}`;

  constructor(private readonly host: ElementRef<HTMLElement>) {}

  get inputId(): string {
    return this.id || this.autoId;
  }
  value: string | number = '';
  private onChange: (value: string | number) => void = () => {};
  private onTouched: () => void = () => {};

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['disabled'] && this.disabled) {
      this.onTouched();
    }
  }

  get inputClass(): string {
    return this.error ? 'db-input db-input--error' : 'db-input';
  }

  writeValue(value: string | number | null): void {
    this.value = value ?? '';
  }

  registerOnChange(fn: (value: string | number) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  onInput(value: string | number): void {
    if (this.type !== 'number' || value === '') {
      this.value = value;
      this.onChange(this.value);
      return;
    }

    let num = Number(value);
    if (!Number.isFinite(num)) {
      this.value = value;
      this.onChange(this.value);
      return;
    }

    const clamped = this.clampNumber(num);
    const wasClamped = clamped !== num;
    this.value = clamped;
    this.onChange(this.value);
    // Si el modelo del padre no cambia (p. ej. ya era 0 y se tipó −5),
    // Angular no llama writeValue; sincronizar el DOM al valor clampeado.
    if (wasClamped) {
      this.syncNativeNumber(clamped);
    }
  }

  onBlur(): void {
    if (this.type === 'number' && this.value !== '' && Number.isFinite(Number(this.value))) {
      const clamped = this.clampNumber(Number(this.value));
      if (clamped !== Number(this.value)) {
        this.value = clamped;
        this.onChange(this.value);
        this.syncNativeNumber(clamped);
      }
    }
    this.onTouched();
  }

  private clampNumber(num: number): number {
    let next = num;
    const minN =
      this.min !== undefined && this.min !== '' ? Number(this.min) : NaN;
    const maxN =
      this.max !== undefined && this.max !== '' ? Number(this.max) : NaN;
    if (Number.isFinite(minN)) next = Math.max(next, minN);
    if (Number.isFinite(maxN)) next = Math.min(next, maxN);
    return next;
  }

  private syncNativeNumber(num: number): void {
    void Promise.resolve().then(() => {
      const input = this.host.nativeElement.querySelector(
        'input',
      ) as HTMLInputElement | null;
      if (!input) return;
      const shown = input.value === '' ? NaN : Number(input.value);
      if (shown !== num) {
        input.value = String(num);
      }
      this.value = num;
    });
  }
}
