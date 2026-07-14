import {
  Component,
  EventEmitter,
  forwardRef,
  Input,
  Output,
} from '@angular/core';
import {
  ControlValueAccessor,
  FormsModule,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';

let dbCheckboxId = 0;

@Component({
  selector: 'db-checkbox',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './db-checkbox.component.html',
  styleUrl: './db-checkbox.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DbCheckboxComponent),
      multi: true,
    },
  ],
  host: {
    '[class.db-checkbox]': 'true',
    '[class.db-checkbox--disabled]': 'disabled',
  },
})
export class DbCheckboxComponent implements ControlValueAccessor {
  @Input() label = '';
  @Input() disabled = false;
  @Input() name = '';
  @Output() checkedChange = new EventEmitter<boolean>();

  readonly checkboxId = `db-checkbox-${++dbCheckboxId}`;
  private _checked = false;
  private onChange: (value: boolean) => void = () => {};
  private onTouched: () => void = () => {};

  @Input()
  get checked(): boolean {
    return this._checked;
  }
  set checked(value: boolean) {
    this._checked = value;
  }

  writeValue(value: boolean): void {
    this._checked = !!value;
  }

  registerOnChange(fn: (value: boolean) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  onToggle(event: Event): void {
    if (this.disabled) return;
    const input = event.target as HTMLInputElement;
    this._checked = input.checked;
    this.onChange(this._checked);
    this.checkedChange.emit(this._checked);
    this.onTouched();
  }
}

@Component({
  selector: 'db-checkbox-group',
  standalone: true,
  template: `<div class="db-checkbox-group"><ng-content /></div>`,
  styleUrl: './db-checkbox-group.component.scss',
})
export class DbCheckboxGroupComponent {}
