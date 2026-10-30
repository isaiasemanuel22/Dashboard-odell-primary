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
import { DbButtonComponent } from '../../../../../components/db-button/db-button.component';
import { DbIconTrashComponent } from '../../../../../components/db-icon-trash/db-icon-trash.component';
import { CurrencyArsPipe } from '../../../../../shared/pipes/labels.pipe';
import {
  DbColorSelectComponent,
  DbInputComponent,
  DbSelectComponent,
  DbTextareaComponent,
} from '@dashboard-form';
import type { DbSelectOption } from '@dashboard-form';
import { INDISTINTO_COLOR_ID } from '../../../../../core/models';
import {
  DynamicFieldConfig,
  DynamicInputFieldConfig,
  DynamicListConfig,
  DynamicSelectFieldConfig,
  DynamicColorSelectFieldConfig,
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
    DbButtonComponent,
    DbIconTrashComponent,
    DbColorSelectComponent,
    DbSelectComponent,
    DbInputComponent,
    DbTextareaComponent,
    CurrencyArsPipe,
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
  /** Filas cuyo color venía Indistinto del catálogo: se puede elegir y no se vuelve a bloquear. */
  private readonly editableColorRowIds = new Set<string>();

  /** Valor inicial al crear/editar; solo actualizar al resetear el formulario padre. */
  @Input() initialValue: any[] | null = null;
  @Input() config!: DynamicListConfig;
  /** Dentro de un bloque que ya tiene título: sin encabezado y con nota y acción en la barra. */
  @Input() embedded = false;
  /** Solo lectura (p. ej. línea con producto de catálogo). */
  @Input() locked = false;

  @Output() valueChange = new EventEmitter<any[]>();
  @Output() footerAction = new EventEmitter<void>();

  /** Formulario reactivo raíz; el array editable está en `formGroup.controls.items`. */
  readonly formGroup = new FormGroup({
    items: new FormArray<FormGroup>([]),
  });

  get itemsArray(): FormArray<FormGroup> {
    return this.formGroup.controls.items;
  }

  ngOnInit(): void {
    this.resetFromInitial();
    this.applyLockedState();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialValue'] || changes['config']) {
      this.resetFromInitial();
      this.applyLockedState();
    }
    if (changes['locked'] && !changes['locked'].firstChange) {
      this.applyLockedState();
    }
  }

  ngOnDestroy(): void {
    this.fieldChangeDestroy$.next();
    this.fieldChangeDestroy$.complete();
  }

  writeValue(value: any[] | null): void {
    this.initialValue = value;
    this.resetFromInitial();
    this.applyLockedState();
  }

  registerOnChange(fn: (value: any[]) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.locked = isDisabled;
    this.applyLockedState();
  }

  private applyLockedState(): void {
    if (!this.locked) {
      this.editableColorRowIds.clear();
      for (const group of this.itemsArray.controls) {
        group.enable({ emitEvent: false });
      }
      this.cdr.markForCheck();
      return;
    }

    const presentIds = new Set<string>();
    for (const group of this.itemsArray.controls) {
      const rowId = String(group.get('id')?.value ?? '');
      presentIds.add(rowId);
      const colorCtrl = group.get('colorId');
      // Solo se marca editable si el catálogo traía Indistinto; al elegir un color
      // el id ya está en el set y no se vuelve a bloquear.
      if (colorCtrl && this.isIndistintoColor(colorCtrl.value)) {
        this.editableColorRowIds.add(rowId);
      }

      for (const [name, control] of Object.entries(group.controls)) {
        const keepColorEditable =
          name === 'colorId' && this.editableColorRowIds.has(rowId);
        if (keepColorEditable) {
          control.enable({ emitEvent: false });
        } else {
          control.disable({ emitEvent: false });
        }
      }
    }
    for (const id of [...this.editableColorRowIds]) {
      if (!presentIds.has(id)) {
        this.editableColorRowIds.delete(id);
      }
    }
    this.cdr.markForCheck();
  }

  private isIndistintoColor(value: unknown): boolean {
    if (value == null || value === '') return true;
    return String(value) === INDISTINTO_COLOR_ID;
  }

  fieldLabel(field: DynamicFieldConfig): string {
    if (field.type === 'dimensions') return field.label ?? '';
    return field.label;
  }

  showField(field: DynamicFieldConfig): boolean {
    return !('hidden' in field && field.hidden);
  }

  asideLabel(): string {
    return this.config.headerAside?.() ?? '';
  }

  step(index: number, field: DynamicInputFieldConfig, direction: number): void {
    const control = this.itemsArray.at(index)?.get(field.name);
    if (!control) return;
    const current = Number(control.value) || 0;
    const amount = field.step ?? 1;
    const min = field.min ?? Number.NEGATIVE_INFINITY;
    const max = field.max ?? Number.POSITIVE_INFINITY;
    const next = Math.min(max, Math.max(min, current + direction * amount));
    control.setValue(Math.round(next * 1000) / 1000);
  }

  canRemove(): boolean {
    if (this.locked) return false;
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

  colorSelectOptions(
    field: DynamicColorSelectFieldConfig,
    index: number,
  ) {
    const item = this.itemsArray.at(index)?.getRawValue();
    return field.optionsFn
      ? field.optionsFn(item, this.itemsArray.getRawValue())
      : [];
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
    if (field.type === 'color-select') {
      return `color-select-${field.name}-${index}`;
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
        const raw = item[field.name];
        const fallback =
          field.type === 'input' &&
          field.inputType === 'number' &&
          field.min != null &&
          field.min >= 1 &&
          (raw === null || raw === undefined || raw === '')
            ? field.min
            : (raw ?? null);
        controls[field.name] = new FormControl(fallback);
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
    if (this.locked && field.type === 'color-select') {
      this.applyLockedState();
    }
  }

  private emitValue(): void {
    const value = structuredClone(this.itemsArray.getRawValue());
    this.valueChange.emit(value);
    this.onChange(value);
    this.cdr.markForCheck();
  }
}
