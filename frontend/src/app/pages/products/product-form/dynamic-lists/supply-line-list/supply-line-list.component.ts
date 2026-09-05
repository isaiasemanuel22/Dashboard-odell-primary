import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  forwardRef,
  inject,
} from '@angular/core';
import {
  ControlValueAccessor,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';
import {
  EstampadoSupplyLine,
  GeneralSettings,
  INDISTINTO_COLOR_ID,
  Supply,
  SupplyCategory,
} from '../../../../../core/models';
import { SuppliesService } from '../../../../../core/services/settings.service';
import { SettingsFacade } from '../../../../../store/settings/settings.facade';
import { createEmptyEstampadoSupplyLine } from '../../../../../shared/utils/estampado.helpers';
import { buildColorOptions } from '../../../../../shared/utils/color.helpers';
import type { DbSelectOption } from '@dashboard-form';
import { Subject, takeUntil } from 'rxjs';
import {
  DynamicListComponent,
  DynamicListConfig,
} from '../dynamic-list/dynamic-list.component';

@Component({
  selector: 'app-supply-line-list',
  standalone: true,
  imports: [DynamicListComponent],
  template: `
    <app-dynamic-list
      [initialValue]="initialValue"
      [config]="supplyConfig"
      (valueChange)="onListChange($event)"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SupplyLineListComponent),
      multi: true,
    },
  ],
})
export class SupplyLineListComponent
  implements OnInit, OnDestroy, ControlValueAccessor
{
  initialValue: EstampadoSupplyLine[] | null = null;

  private readonly suppliesService = inject(SuppliesService);
  private readonly settingsFacade = inject(SettingsFacade);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();
  private suppliesCatalog: Supply[] = [];
  private generalSettings: GeneralSettings | null = null;
  private onChange: (value: EstampadoSupplyLine[]) => void = () => {};
  private onTouched: () => void = () => {};

  readonly supplyConfig: DynamicListConfig = {
    legend: 'Insumos',
    description:
      'Seleccioná insumos del catálogo (Insumos → Estampado): remeras, tinta, film, etc. El costo se calcula con el precio unitario del stock.',
    itemLabel: (index) => `Insumo ${index + 1}`,
    addButtonLabel: '+ Agregar insumo',
    emptyMessage: 'Sin insumos configurados',
    minItems: 0,
    createItem: () => createEmptyEstampadoSupplyLine(),
    fields: [
      {
        type: 'input',
        name: 'label',
        label: 'Etiqueta (opcional)',
        placeholder: 'Ej: Remera base',
      },
      {
        type: 'select',
        name: 'supplyId',
        label: 'Insumo',
        placeholder: 'Seleccionar insumo...',
        optionsFn: (item, items) => this.getSupplyOptionsFor(item, items),
        changeFn: (item) => {
          item.colorId = INDISTINTO_COLOR_ID;
        },
      },
      {
        type: 'color-select',
        name: 'colorId',
        label: 'Color',
        fullWidth: true,
        optionsFn: (item) => this.getColorOptions(item),
      },
      {
        type: 'input',
        name: 'quantity',
        label: 'Cantidad',
        inputType: 'number',
        min: 0.01,
        step: 0.01,
      },
    ],
  };

  ngOnInit(): void {
    this.settingsFacade
      .watchGeneralSettings()
      .pipe(takeUntil(this.destroy$))
      .subscribe((settings) => {
        this.generalSettings = settings;
        this.cdr.markForCheck();
      });

    this.suppliesService
      .watchSupplies(SupplyCategory.ESTAMPADO)
      .pipe(takeUntil(this.destroy$))
      .subscribe((items: Supply[]) => {
        this.suppliesCatalog = items;
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  writeValue(value: EstampadoSupplyLine[] | null): void {
    this.initialValue = value;
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (value: EstampadoSupplyLine[]) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(_isDisabled: boolean): void {
    this.cdr.markForCheck();
  }

  onListChange(value: EstampadoSupplyLine[]): void {
    this.onChange(value);
    this.onTouched();
  }

  private getSupplyOptionsFor(
    line: EstampadoSupplyLine,
    allLines: EstampadoSupplyLine[],
  ): DbSelectOption[] {
    const usedSupplyIds = new Set(
      allLines
        .filter((item) => item.id !== line.id && item.supplyId)
        .map((item) => item.supplyId),
    );

    return this.suppliesCatalog
      .filter((supply) => !usedSupplyIds.has(supply.id))
      .map((supply) => ({
        value: supply.id,
        label: `${supply.name} (${supply.unit})`,
      }));
  }

  private getColorOptions(line: EstampadoSupplyLine): DbSelectOption[] {
    return buildColorOptions(
      this.suppliesCatalog,
      this.generalSettings?.colors ?? [],
      { supplyId: line.supplyId },
    );
  }
}
