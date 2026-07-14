import {
  Component,
  forwardRef,
  Input,
} from '@angular/core';
import {
  ControlValueAccessor,
  FormsModule,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';
import { DbFormFieldComponent } from '../db-form-field/db-form-field.component';

let dbTextareaId = 0;

@Component({
  selector: 'db-textarea',
  standalone: true,
  imports: [FormsModule, DbFormFieldComponent],
  templateUrl: './db-textarea.component.html',
  styleUrl: './db-textarea.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DbTextareaComponent),
      multi: true,
    },
  ],
})
export class DbTextareaComponent implements ControlValueAccessor {
  @Input() label = '';
  @Input() hint = '';
  @Input() error = '';
  @Input() required = false;
  @Input() name = '';
  @Input() placeholder = '';
  @Input() rows = 4;
  @Input() maxLength?: number;
  @Input() disabled = false;
  @Input() readonly = false;

  readonly textareaId = `db-textarea-${++dbTextareaId}`;
  value = '';
  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  get textareaClass(): string {
    return this.error ? 'db-textarea db-textarea--error' : 'db-textarea';
  }

  writeValue(value: string | null): void {
    this.value = value ?? '';
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  onInput(value: string): void {
    this.value = value;
    this.onChange(value);
  }

  onBlur(): void {
    this.onTouched();
  }

  get charCountHint(): string {
    if (!this.maxLength) return '';
    return `${this.value.length}/${this.maxLength}`;
  }
}
