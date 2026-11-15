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

import { selectIfZero } from '../../../shared/directives/keep-typing.directive';

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
  @Input() type: 'text' | 'number' | 'search' | 'password' | 'email' | 'date' | 'time' = 'text';
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
  private modelValue: string | number = '';
  private focused = false;
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
    this.modelValue = value ?? '';
    // Mientras se escribe un número, el campo muestra lo tipeado (vacío, 0 o
    // un valor fuera de rango); el valor del modelo se muestra al salir.
    if (this.type === 'number' && this.focused) return;
    this.value = this.modelValue;
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

  onFocus(): void {
    this.focused = true;
    if (this.type === 'number') {
      const input = this.host.nativeElement.querySelector('input');
      if (input) selectIfZero(input as HTMLInputElement);
    }
  }

  onInput(value: string | number): void {
    this.value = value;
    if (this.type !== 'number' || value === '') {
      this.emit(value);
      return;
    }

    const num = Number(value);
    // El modelo recibe el valor dentro de min/max, pero el campo no se
    // corrige mientras se escribe: así se puede borrar o pasar por 0.
    this.emit(Number.isFinite(num) ? this.clampNumber(num) : value);
  }

  /**
   * Los formularios reactivos no llaman a writeValue con lo que viene de la
   * vista: se guarda acá lo emitido para mostrarlo al salir del campo.
   */
  private emit(value: string | number): void {
    this.modelValue = value;
    this.onChange(value);
  }

  onBlur(): void {
    this.focused = false;
    if (this.type === 'number') {
      const typed = this.value;
      if (typed !== '' && Number.isFinite(Number(typed))) {
        const clamped = this.clampNumber(Number(typed));
        if (clamped !== Number(typed)) this.emit(clamped);
      }
      this.syncNativeToModel();
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

  /** Al salir del campo, muestra el valor que quedó en el modelo. */
  private syncNativeToModel(): void {
    void Promise.resolve().then(() => {
      if (this.focused) return;
      const next = this.modelValue;
      this.value = next;
      const input = this.host.nativeElement.querySelector(
        'input',
      ) as HTMLInputElement | null;
      if (input && input.value !== String(next)) {
        input.value = String(next);
      }
    });
  }
}
