import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnDestroy,
  OnInit,
  forwardRef,
  inject,
} from '@angular/core';
import {
  ControlValueAccessor,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import {
  FdmFilamentLine,
  FilamentType,
  GeneralSettings,
  INDISTINTO_COLOR_ID,
  Supply,
  SupplyCategory,
} from '../../../../../core/models';
import { SettingsFacade } from '../../../../../store/settings/settings.facade';
import { SuppliesService } from '../../../../../core/services/settings.service';
import { buildFilamentTypeOptions } from '../../../../../shared/utils/filament-type.util';
import { buildColorOptions } from '../../../../../shared/utils/color.helpers';
import {
  createEmptyFdmFilamentLine,
  totalFdmFilamentGrams,
} from '../../../../../shared/utils/fdm.helpers';
import type { DbSelectOption } from '@dashboard-form';
import {
  DynamicListComponent,
  DynamicListConfig,
} from '../dynamic-list/dynamic-list.component';

@Component({
  selector: 'app-filament-line-list',
  standalone: true,
  imports: [DynamicListComponent],
  template: `
    <app-dynamic-list
      [initialValue]="initialValue"
      [config]="filamentConfig"
      (valueChange)="onListChange($event)"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => FilamentLineListComponent),
      multi: true,
    },
  ],
})
export class FilamentLineListComponent
  implements OnInit, OnDestroy, ControlValueAccessor
{
  @Input() primaryFilamentType: FilamentType = FilamentType.PLA;

  initialValue: FdmFilamentLine[] | null = null;

  private readonly settingsFacade = inject(SettingsFacade);
  private readonly suppliesService = inject(SuppliesService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();
  private generalSettings: GeneralSettings | null = null;
  private fdmSupplies: Supply[] = [];
  private onChange: (value: FdmFilamentLine[]) => void = () => {};
  private onTouched: () => void = () => {};

  readonly filamentConfig: DynamicListConfig = {
    legend: 'Filamentos',
    description:
      'Sumá cada filamento usado en la impresión. El costo de material es la suma de todos.',
    itemLabel: (index) => `Filamento ${index + 1}`,
    addButtonLabel: '+ Agregar filamento',
    emptyMessage: 'Sin filamentos configurados',
    totalLabel: 'Total',
    totalValueFn: (items) => `${totalFdmFilamentGrams(items)} g`,
    minItems: 1,
    createItem: () =>
      createEmptyFdmFilamentLine(this.primaryFilamentType),
    showRemoveButton: (items) => items.length > 1,
    fields: [
      {
        type: 'input',
        name: 'label',
        label: 'Etiqueta (opcional)',
        placeholder: 'Ej: Base PLA',
      },
      {
        type: 'select',
        name: 'filamentType',
        label: 'Tipo de filamento',
        optionsFn: (item, items) => this.getFilamentTypeOptions(item, items),
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
        name: 'grams',
        label: 'Gramos',
        inputType: 'number',
        min: 0.1,
        step: 0.1,
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
      .watchSupplies(SupplyCategory.FDM)
      .pipe(takeUntil(this.destroy$))
      .subscribe((items) => {
        this.fdmSupplies = items;
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  writeValue(value: FdmFilamentLine[] | null): void {
    this.initialValue = value;
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (value: FdmFilamentLine[]) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.cdr.markForCheck();
  }

  onListChange(value: FdmFilamentLine[]): void {
    this.onChange(value);
    this.onTouched();
  }

  private getFilamentTypeOptions(
    line: FdmFilamentLine,
    allLines: FdmFilamentLine[],
  ): DbSelectOption[] {
    const extraTypes = [
      ...allLines.map((f) => f.filamentType).filter(Boolean),
      this.primaryFilamentType,
      line.filamentType,
    ];

    const options = buildFilamentTypeOptions(
      this.generalSettings?.filamentPrices ?? [],
      extraTypes,
    );
    return [{ value: '', label: 'Elegí el tipo' }, ...options];
  }

  private getColorOptions(line: FdmFilamentLine): DbSelectOption[] {
    return buildColorOptions(
      this.fdmSupplies,
      this.generalSettings?.colors ?? [],
      { filamentType: line.filamentType },
    );
  }
}
