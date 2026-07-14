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
import { DbSelectOption } from './db-select.types';

let dbSelectId = 0;

@Component({
  selector: 'db-select',
  standalone: true,
  imports: [FormsModule, DbFormFieldComponent],
  templateUrl: './db-select.component.html',
  styleUrl: './db-select.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DbSelectComponent),
      multi: true,
    },
  ],
})
export class DbSelectComponent implements ControlValueAccessor, OnChanges {
  @Input() label = '';
  @Input() hint = '';
  @Input() error = '';
  @Input() required = false;
  @Input() name = '';
  @Input() placeholder = '';
  @Input() disabled = false;
  @Input() options: DbSelectOption[] = [];

  readonly selectId = `db-select-${++dbSelectId}`;
  value: unknown = '';
  private onChange: (value: unknown) => void = () => {};
  private onTouched: () => void = () => {};

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['disabled'] && this.disabled) {
      this.onTouched();
    }
  }

  get selectClass(): string {
    return this.error ? 'db-select db-select--error' : 'db-select';
  }

  writeValue(value: unknown): void {
    this.value = value ?? '';
  }

  registerOnChange(fn: (value: unknown) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  onSelect(value: unknown): void {
    this.value = value;
    this.onChange(value);
  }

  onBlur(): void {
    this.onTouched();
  }
}
