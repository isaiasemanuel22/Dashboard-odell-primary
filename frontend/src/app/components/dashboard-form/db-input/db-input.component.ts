import {
  Component,
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

  readonly inputId = `db-input-${++dbInputId}`;
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
    this.value = this.type === 'number' && value !== '' ? Number(value) : value;
    this.onChange(this.value);
  }

  onBlur(): void {
    this.onTouched();
  }
}
