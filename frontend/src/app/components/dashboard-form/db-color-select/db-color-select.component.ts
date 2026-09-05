import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  forwardRef,
  HostListener,
  Input,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import {
  ControlValueAccessor,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';
import { DbFormFieldComponent } from '../db-form-field/db-form-field.component';
import { DbColorSelectOption } from './db-color-select.types';

let dbColorSelectId = 0;

@Component({
  selector: 'db-color-select',
  standalone: true,
  imports: [NgTemplateOutlet, DbFormFieldComponent],
  templateUrl: './db-color-select.component.html',
  styleUrl: './db-color-select.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DbColorSelectComponent),
      multi: true,
    },
  ],
})
export class DbColorSelectComponent implements ControlValueAccessor, OnChanges {
  @Input() label = '';
  @Input() hint = '';
  @Input() error = '';
  @Input() required = false;
  @Input() disabled = false;
  @Input() options: DbColorSelectOption[] = [];

  readonly groupId = `db-color-select-${++dbColorSelectId}`;
  value: string = '';
  panelOpen = false;

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['disabled'] && this.disabled) {
      this.closePanel();
      this.onTouched();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.panelOpen) {
      this.closePanel();
    }
  }

  selectedOption(): DbColorSelectOption | undefined {
    return this.options.find((option) => option.value === this.value);
  }

  isSelected(value: string): boolean {
    return this.value === value;
  }

  openPanel(): void {
    if (this.disabled) {
      return;
    }

    this.panelOpen = true;
    this.onTouched();
  }

  closePanel(): void {
    this.panelOpen = false;
  }

  pick(value: string): void {
    if (this.disabled) {
      return;
    }

    this.value = value;
    this.onChange(value);
    this.onTouched();
    this.closePanel();
  }

  writeValue(value: unknown): void {
    this.value = typeof value === 'string' ? value : '';
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    if (isDisabled) {
      this.closePanel();
    }
  }
}
