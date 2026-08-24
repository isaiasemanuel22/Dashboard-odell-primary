import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  forwardRef,
  inject,
} from '@angular/core';
import {
  ControlValueAccessor,
  FormArray,
  FormControl,
  FormGroup,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
} from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import {
  DbButtonComponent,
  DbFieldsetComponent,
  DbInputComponent,
  DbSelectComponent,
  DbSelectOption,
  DbTextareaComponent,
} from '@general-components';
import {
  DynamicFieldConfig,
  DynamicListConfig,
  DynamicSelectFieldConfig,
} from './dynamic-list.types';

export type {
  DynamicDimensionsFieldConfig,
  DynamicFieldConfig,
  DynamicInputFieldConfig,
  DynamicListConfig,
  DynamicSelectFieldConfig,
  DynamicTextareaFieldConfig,
} from './dynamic-list.types';

@Component({
  selector: 'app-dynamic-list',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DbFieldsetComponent,
    DbButtonComponent,
    DbSelectComponent,
    DbInputComponent,
    DbTextareaComponent,
  ],
  templateUrl: './dynamic-list.component.html',
  styleUrl: './dynamic-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DynamicListComponent),
      multi: true,
    },
  ],
})
export class DynamicListComponent
  implements OnInit, OnChanges, OnDestroy, ControlValueAccessor
{
  private readonly cdr = inject(ChangeDetectorRef);
  private fieldChangeDestroy$ = new Subject<void>();
  private onChange: (value: any[]) => void = () => {};
  private onTouched: () => void = () => {};

  /** Valor inicial al crear/editar; solo actualizar al resetear el formulario padre. */
  @Input() initialValue: any[] | null = null;
  @Input() config!: DynamicListConfig;

  @Output() valueChange = new EventEmitter<any[]>();

  /** Formulario reactivo raíz; el array editable está en `formGroup.controls.items`. */
  readonly formGroup = new FormGroup({
    items: new FormArray<FormGroup>([]),
  });

  get itemsArray(): FormArray<FormGroup> {
    return this.formGroup.controls.items;
  }

  ngOnInit(): void {
    this.resetFromInitial();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialValue'] || changes['config']) {
      this.resetFromInitial();
    }
  }

  ngOnDestroy(): void {
    this.fieldChangeDestroy$.next();
    this.fieldChangeDestroy$.complete();
  }

  writeValue(value: any[] | null): void {
    this.initialValue = value;
    this.resetFromInitial();
  }

  registerOnChange(fn: (value: any[]) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    if (isDisabled) {
      this.formGroup.disable({ emitEvent: false });
    } else {
      this.formGroup.enable({ emitEvent: false });
    }
    this.cdr.markForCheck();
  }

  canRemove(): boolean {
    const count = this.itemsArray.length;
    if (!this.config?.showRemoveButton) {
      return count > (this.config?.minItems ?? 0);
    }
    return this.config.showRemoveButton(this.itemsArray.getRawValue());
  }

  selectOptions(
    field: DynamicSelectFieldConfig,
    index: number,
  ): DbSelectOption[] {
    const item = this.itemsArray.at(index)?.getRawValue();
    return field.optionsFn
      ? field.optionsFn(item, this.itemsArray.getRawValue())
      : (field.options ?? []);
  }

  onAdd(): void {
    if (!this.config?.createItem) {
      return;
    }
    const group = this.buildItemGroup(this.config.createItem());
    this.itemsArray.push(group);
    this.wireFieldChanges(group, this.itemsArray.length - 1);
    this.emitValue();
    this.onTouched();
  }

  onRemove(index: number): void {
    this.itemsArray.removeAt(index);
    const minItems = this.config?.minItems ?? 0;

    if (this.itemsArray.length < minItems && this.config?.createItem) {
      while (this.itemsArray.length < minItems) {
        const group = this.buildItemGroup(this.config.createItem());
        this.itemsArray.push(group);
        this.wireFieldChanges(group, this.itemsArray.length - 1);
      }
    }

    this.emitValue();
    this.onTouched();
  }

  trackByIndex(index: number, control: FormGroup): string {
    const id = control.get('id')?.value;
    return typeof id === 'string' && id ? id : `idx-${index}`;
  }

  fieldTrack(index: number, field: DynamicFieldConfig): string {
    if (field.type === 'dimensions') {
      return `dimensions-${field.widthName}-${field.lengthName}-${index}`;
    }
    return `${field.type}-${field.name}-${index}`;
  }

  private resetFromInitial(): void {
    if (!this.config) {
      return;
    }

    const items = this.resolveInitialItems();
    this.rebuildForm(items);
  }

  private resolveInitialItems(): any[] {
    if (!this.config?.createItem) {
      return this.initialValue?.length ? structuredClone(this.initialValue) : [];
    }

    const minItems = this.config.minItems ?? 0;
    if (this.initialValue?.length) {
      return structuredClone(this.initialValue);
    }
    if (minItems > 0) {
      return Array.from({ length: minItems }, () => this.config.createItem());
    }
    return [];
  }

  private rebuildForm(items: any[]): void {
    this.fieldChangeDestroy$.next();
    this.itemsArray.clear({ emitEvent: false });

    for (const item of items) {
      const group = this.buildItemGroup(item);
      this.itemsArray.push(group, { emitEvent: false });
      this.wireFieldChanges(group, this.itemsArray.length - 1);
    }

    this.cdr.markForCheck();
  }

  private buildItemGroup(item: Record<string, unknown>): FormGroup {
    const controls: Record<string, FormControl<unknown>> = {
      id: new FormControl(item['id'] ?? '', { nonNullable: true }),
    };

    for (const field of this.config.fields) {
      if (field.type === 'dimensions') {
        controls[field.widthName] = new FormControl(item[field.widthName] ?? null);
        controls[field.lengthName] = new FormControl(
          item[field.lengthName] ?? null,
        );
      } else {
        controls[field.name] = new FormControl(item[field.name] ?? null);
      }
    }

    return new FormGroup(controls);
  }

  private wireFieldChanges(group: FormGroup, index: number): void {
    for (const field of this.config.fields) {
      for (const controlName of this.controlNamesForField(field)) {
        group
          .get(controlName)
          ?.valueChanges.pipe(takeUntil(this.fieldChangeDestroy$))
          .subscribe(() => this.onFieldChange(index, field));
      }
    }
  }

  private controlNamesForField(field: DynamicFieldConfig): string[] {
    if (field.type === 'dimensions') {
      return [field.widthName, field.lengthName];
    }
    return [field.name];
  }

  private onFieldChange(index: number, field: DynamicFieldConfig): void {
    const group = this.itemsArray.at(index);
    if (!group) {
      return;
    }

    if ('changeFn' in field && field.changeFn) {
      const item = { ...group.getRawValue() };
      field.changeFn(item, this.itemsArray.getRawValue());
      group.patchValue(item, { emitEvent: false });
    }

    this.emitValue();
    this.onTouched();
  }

  private emitValue(): void {
    const value = structuredClone(this.itemsArray.getRawValue());
    this.valueChange.emit(value);
    this.onChange(value);
    this.cdr.markForCheck();
  }
}
