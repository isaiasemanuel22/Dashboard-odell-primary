import {
  Component,
  ElementRef,
  EventEmitter,
  forwardRef,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
  inject,
} from '@angular/core';
import {
  ControlValueAccessor,
  FormsModule,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';
import { DbFormFieldComponent } from '../db-form-field/db-form-field.component';
import { DbAutocompleteOption } from './db-autocomplete.types';

let dbAutocompleteId = 0;

@Component({
  selector: 'db-autocomplete',
  standalone: true,
  imports: [FormsModule, DbFormFieldComponent],
  templateUrl: './db-autocomplete.component.html',
  styleUrl: './db-autocomplete.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DbAutocompleteComponent),
      multi: true,
    },
  ],
})
export class DbAutocompleteComponent implements ControlValueAccessor, OnChanges {
  private readonly host = inject(ElementRef<HTMLElement>);

  @Input() label = '';
  @Input() hint = '';
  @Input() error = '';
  @Input() required = false;
  @Input() placeholder = '';
  @Input() name = '';
  @Input() disabled = false;
  @Input() allowCreate = true;
  @Input() preserveCase = false;
  @Input() minFilterChars = 0;
  @Input() createLabel = (query: string) => `Crear "${query}"`;
  @Input() options: DbAutocompleteOption[] = [];

  @Output() optionCreated = new EventEmitter<string>();
  @Output() optionSelected = new EventEmitter<DbAutocompleteOption>();

  @ViewChild('inputRef') inputRef?: ElementRef<HTMLInputElement>;

  readonly inputId = `db-autocomplete-${++dbAutocompleteId}`;

  value = '';
  query = '';
  isOpen = false;
  highlightedIndex = -1;

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['disabled'] && this.disabled) {
      this.closeDropdown();
      this.onTouched();
    }

    if (changes['options'] && !this.isOpen) {
      this.query = this.labelForValue(this.value);
    }
  }

  get inputClass(): string {
    return this.error ? 'db-input db-input--error' : 'db-input';
  }

  get filteredOptions(): DbAutocompleteOption[] {
    const normalizedQuery = this.query.trim().toLowerCase();
    if (normalizedQuery.length < this.minFilterChars) {
      return this.options;
    }

    return this.options.filter(
      (option) =>
        option.label.toLowerCase().includes(normalizedQuery) ||
        option.value.toLowerCase().includes(normalizedQuery),
    );
  }

  get canFilter(): boolean {
    return this.query.trim().length >= this.minFilterChars;
  }

  get showCreateOption(): boolean {
    if (!this.allowCreate || !this.canFilter) return false;

    const trimmed = this.query.trim();
    if (!trimmed) return false;

    return !this.options.some(
      (option) =>
        option.label.toLowerCase() === trimmed.toLowerCase() ||
        option.value.toLowerCase() === trimmed.toLowerCase(),
    );
  }

  writeValue(value: string | null): void {
    this.value = value ?? '';
    this.query = this.labelForValue(this.value);
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

  onFocus(): void {
    if (this.disabled) return;
    this.isOpen = true;
    this.highlightedIndex = -1;
  }

  focusInput(): void {
    this.inputRef?.nativeElement.focus();
    this.onFocus();
  }

  onQueryChange(nextQuery: string): void {
    this.query = nextQuery;
    this.isOpen = true;
    this.highlightedIndex = -1;
  }

  onInputKeydown(event: KeyboardEvent): void {
    if (!this.isOpen) {
      if (event.key === 'ArrowDown' || event.key === 'Enter') {
        this.isOpen = true;
        event.preventDefault();
      }
      return;
    }

    const itemCount = this.filteredOptions.length + (this.showCreateOption ? 1 : 0);
    if (itemCount === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.highlightedIndex = (this.highlightedIndex + 1) % itemCount;
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.highlightedIndex =
        this.highlightedIndex <= 0 ? itemCount - 1 : this.highlightedIndex - 1;
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      this.selectHighlighted();
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeDropdown();
      this.query = this.labelForValue(this.value);
    }
  }

  onOptionMouseDown(event: MouseEvent): void {
    event.preventDefault();
  }

  selectOption(option: DbAutocompleteOption): void {
    this.applyValue(option.value, option.label);
    this.optionSelected.emit(option);
    this.closeDropdown();
    this.inputRef?.nativeElement.blur();
  }

  selectCreateOption(): void {
    const trimmed = this.query.trim();
    if (!trimmed) return;

    const normalized = this.normalizeValue(trimmed);
    this.applyValue(normalized, this.displayLabelForValue(normalized));
    this.optionCreated.emit(normalized);
    this.closeDropdown();
    this.inputRef?.nativeElement.blur();
  }

  onInputBlur(): void {
    // El clic en una opción hace preventDefault en mousedown y no dispara blur.
    // Confirmar acá, sin demora, para que Guardar vea el nombre en el primer clic.
    if (!this.isOpen) {
      this.onTouched();
      return;
    }
    this.commitQuery();
    this.closeDropdown();
    this.onTouched();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) {
      if (this.isOpen) {
        this.commitQuery();
        this.closeDropdown();
      }
    }
  }

  private commitQuery(): void {
    const trimmed = this.query.trim();

    if (!trimmed) {
      this.applyValue('', '');
      return;
    }

    const exactMatch = this.options.find(
      (option) =>
        option.label.toLowerCase() === trimmed.toLowerCase() ||
        option.value.toLowerCase() === trimmed.toLowerCase(),
    );

    if (exactMatch) {
      this.applyValue(exactMatch.value, exactMatch.label);
      this.optionSelected.emit(exactMatch);
      return;
    }

    if (this.allowCreate && this.canFilter) {
      const normalized = this.normalizeValue(trimmed);
      this.applyValue(normalized, this.displayLabelForValue(normalized));
      this.optionCreated.emit(normalized);
      return;
    }

    this.query = this.labelForValue(this.value);
  }

  private selectHighlighted(): void {
    const options = this.filteredOptions;
    if (this.highlightedIndex < 0) {
      this.commitQuery();
      return;
    }

    if (this.highlightedIndex < options.length) {
      this.selectOption(options[this.highlightedIndex]);
      return;
    }

    this.selectCreateOption();
  }

  private applyValue(value: string, label: string): void {
    this.value = value;
    this.query = label;
    this.onChange(value);
  }

  private closeDropdown(): void {
    this.isOpen = false;
    this.highlightedIndex = -1;
  }

  private labelForValue(value: string): string {
    if (!value) return '';
    return this.displayLabelForValue(value);
  }

  private displayLabelForValue(value: string): string {
    const match = this.options.find(
      (option) => option.value.toLowerCase() === value.toLowerCase(),
    );
    return match?.label ?? (this.preserveCase ? value : value.toUpperCase());
  }

  private normalizeValue(value: string): string {
    const trimmed = value.trim();
    return this.preserveCase ? trimmed : trimmed.toLowerCase();
  }
}
